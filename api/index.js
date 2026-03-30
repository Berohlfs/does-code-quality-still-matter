const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");
const { put, del } = require("@vercel/blob");

const app = express();
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }
});

function getSQL() {
  return neon(process.env.DATABASE_URL);
}

// Auto-migrate
let migrated = false;
app.use(async (req, res, next) => {
  try {
    if (!migrated) {
      const sql = getSQL();
      await sql`
        CREATE TABLE IF NOT EXISTS todos (
          id BIGINT PRIMARY KEY,
          parent_id BIGINT,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          status TEXT DEFAULT 'pending',
          due_date TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY,
          todo_id BIGINT NOT NULL,
          blob_url TEXT NOT NULL,
          original_name TEXT NOT NULL,
          size INTEGER NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS notes (
          id BIGINT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      migrated = true;
    }
    next();
  } catch (err) {
    next(err);
  }
});

// GET /api/todos
app.get("/api/todos", async (req, res) => {
  const sql = getSQL();
  const todos = await sql`SELECT * FROM todos ORDER BY created_at`;
  const attachments = await sql`SELECT * FROM attachments`;

  res.json(todos.map(t => ({
    id: Number(t.id),
    parentId: t.parent_id ? Number(t.parent_id) : null,
    title: t.title,
    description: t.description || "",
    status: t.status,
    dueDate: t.due_date || null,
    attachments: attachments
      .filter(a => Number(a.todo_id) === Number(t.id))
      .map(a => ({
        id: a.id,
        url: a.blob_url,
        originalName: a.original_name,
        size: Number(a.size)
      }))
  })));
});

// POST /api/todos
app.post("/api/todos", async (req, res) => {
  const { title, description, dueDate, parentId, status } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });

  const sql = getSQL();
  const id = Date.now();
  const validStatus = ["pending", "in-progress", "done"].includes(status) ? status : "pending";
  const pId = parentId != null ? Number(parentId) : null;

  if (pId != null) {
    const rows = await sql`SELECT id FROM todos WHERE id = ${pId}`;
    if (rows.length === 0) return res.status(400).json({ error: "Parent not found" });
  }

  await sql`
    INSERT INTO todos (id, parent_id, title, description, status, due_date)
    VALUES (${id}, ${pId}, ${title.trim()}, ${(description || "").trim()}, ${validStatus}, ${dueDate || null})
  `;

  res.status(201).json({
    id,
    parentId: pId,
    title: title.trim(),
    description: (description || "").trim(),
    status: validStatus,
    dueDate: dueDate || null,
    attachments: []
  });
});

// PUT /api/todos/:id
app.put("/api/todos/:id", async (req, res) => {
  const sql = getSQL();
  const id = Number(req.params.id);
  const rows = await sql`SELECT * FROM todos WHERE id = ${id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });

  const todo = rows[0];
  const title = req.body.title !== undefined ? req.body.title.trim() : todo.title;
  const description = req.body.description !== undefined ? req.body.description.trim() : (todo.description || "");
  const status = req.body.status !== undefined ? req.body.status : todo.status;
  const dueDate = req.body.dueDate !== undefined ? req.body.dueDate : todo.due_date;

  await sql`
    UPDATE todos SET title = ${title}, description = ${description}, status = ${status}, due_date = ${dueDate}
    WHERE id = ${id}
  `;

  const atts = await sql`SELECT * FROM attachments WHERE todo_id = ${id}`;

  res.json({
    id,
    parentId: todo.parent_id ? Number(todo.parent_id) : null,
    title,
    description,
    status,
    dueDate,
    attachments: atts.map(a => ({
      id: a.id,
      url: a.blob_url,
      originalName: a.original_name,
      size: Number(a.size)
    }))
  });
});

// DELETE /api/todos/:id
app.delete("/api/todos/:id", async (req, res) => {
  const sql = getSQL();
  const id = Number(req.params.id);
  const cascade = req.query.cascade !== "false";

  const rows = await sql`SELECT * FROM todos WHERE id = ${id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });
  const todo = rows[0];

  if (cascade) {
    // Get blob URLs for this todo and all descendants
    const atts = await sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
      SELECT blob_url FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
    `;
    for (const a of atts) {
      try { await del(a.blob_url); } catch (e) { /* ignore */ }
    }

    // Delete DB records (attachments first, then todos)
    await sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
      DELETE FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
    `;
    await sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
      DELETE FROM todos WHERE id IN (SELECT id FROM descendants)
    `;
  } else {
    // Reparent children
    const newParent = todo.parent_id || null;
    await sql`UPDATE todos SET parent_id = ${newParent} WHERE parent_id = ${id}`;

    // Delete only this todo's blobs
    const atts = await sql`SELECT blob_url FROM attachments WHERE todo_id = ${id}`;
    for (const a of atts) {
      try { await del(a.blob_url); } catch (e) { /* ignore */ }
    }

    await sql`DELETE FROM attachments WHERE todo_id = ${id}`;
    await sql`DELETE FROM todos WHERE id = ${id}`;
  }

  res.status(204).end();
});

// POST /api/todos/:id/attachments
app.post("/api/todos/:id/attachments", upload.array("files", 10), async (req, res) => {
  const sql = getSQL();
  const todoId = Number(req.params.id);
  const rows = await sql`SELECT id FROM todos WHERE id = ${todoId}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });

  const added = [];
  for (const file of req.files) {
    const attId = crypto.randomBytes(6).toString("hex");
    const blob = await put(`${attId}-${file.originalname}`, file.buffer, { access: "public" });

    await sql`
      INSERT INTO attachments (id, todo_id, blob_url, original_name, size)
      VALUES (${attId}, ${todoId}, ${blob.url}, ${file.originalname}, ${file.size})
    `;

    added.push({ id: attId, url: blob.url, originalName: file.originalname, size: file.size });
  }

  res.json(added);
});

// DELETE /api/todos/:id/attachments/:attId
app.delete("/api/todos/:id/attachments/:attId", async (req, res) => {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM attachments WHERE id = ${req.params.attId} AND todo_id = ${Number(req.params.id)}`;
  if (rows.length === 0) return res.status(404).json({ error: "Attachment not found" });

  try { await del(rows[0].blob_url); } catch (e) { /* ignore */ }
  await sql`DELETE FROM attachments WHERE id = ${req.params.attId}`;
  res.status(204).end();
});

// ── Notes API ──

// GET /api/notes
app.get("/api/notes", async (req, res) => {
  const sql = getSQL();
  const notes = await sql`SELECT * FROM notes ORDER BY updated_at DESC`;
  res.json(notes.map(n => ({
    id: Number(n.id),
    title: n.title,
    content: n.content || "",
    createdAt: n.created_at,
    updatedAt: n.updated_at
  })));
});

// POST /api/notes
app.post("/api/notes", async (req, res) => {
  const { title, content } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });

  const sql = getSQL();
  const id = Date.now();
  await sql`
    INSERT INTO notes (id, title, content)
    VALUES (${id}, ${title.trim()}, ${(content || "").trim()})
  `;

  res.status(201).json({
    id,
    title: title.trim(),
    content: (content || "").trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
});

// PUT /api/notes/:id
app.put("/api/notes/:id", async (req, res) => {
  const sql = getSQL();
  const id = Number(req.params.id);
  const rows = await sql`SELECT * FROM notes WHERE id = ${id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });

  const note = rows[0];
  const title = req.body.title !== undefined ? req.body.title.trim() : note.title;
  const content = req.body.content !== undefined ? req.body.content.trim() : (note.content || "");

  await sql`
    UPDATE notes SET title = ${title}, content = ${content}, updated_at = NOW()
    WHERE id = ${id}
  `;

  res.json({ id, title, content, createdAt: note.created_at, updatedAt: new Date().toISOString() });
});

// DELETE /api/notes/:id
app.delete("/api/notes/:id", async (req, res) => {
  const sql = getSQL();
  const id = Number(req.params.id);
  const rows = await sql`SELECT id FROM notes WHERE id = ${id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });

  await sql`DELETE FROM notes WHERE id = ${id}`;
  res.status(204).end();
});

module.exports = app;
