const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { neon } = require("@neondatabase/serverless");
const { put, del } = require("@vercel/blob");
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendNewTodoEmail(todo, userEmail) {
  try {
    await mailTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: userEmail,
      subject: `New Todo: ${todo.title}`,
      text: [
        `A new todo item was added.`,
        ``,
        `Title: ${todo.title}`,
        `Description: ${todo.description || "(none)"}`,
        `Status: ${todo.status}`,
        `Due Date: ${todo.dueDate || "(none)"}`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("Failed to send todo email notification:", err.message);
  }
}

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
        CREATE TABLE IF NOT EXISTS users (
          id BIGINT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS todos (
          id BIGINT PRIMARY KEY,
          user_id BIGINT NOT NULL,
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
        CREATE TABLE IF NOT EXISTS folders (
          id BIGINT PRIMARY KEY,
          user_id BIGINT NOT NULL,
          name TEXT NOT NULL,
          color TEXT DEFAULT '#6366f1',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      // Migrate existing tables: add user_id if missing
      try {
        await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id BIGINT`;
      } catch (e) { /* column already exists */ }
      try {
        await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS folder_id BIGINT`;
      } catch (e) { /* column already exists */ }
      migrated = true;
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ── Auth helpers ──

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Auth endpoints ──

app.post("/api/auth/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Name is required" });
  if (!email || !email.trim()) return res.status(400).json({ error: "Email is required" });
  if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const sql = getSQL();
  const existing = await sql`SELECT id FROM users WHERE email = ${email.trim().toLowerCase()}`;
  if (existing.length > 0) return res.status(409).json({ error: "Email already in use" });

  const id = Date.now();
  const passwordHash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO users (id, name, email, password_hash)
    VALUES (${id}, ${name.trim()}, ${email.trim().toLowerCase()}, ${passwordHash})
  `;

  const user = { id, name: name.trim(), email: email.trim().toLowerCase() };
  res.status(201).json({ token: signToken(user), user });
});

app.post("/api/auth/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const sql = getSQL();
  const rows = await sql`SELECT * FROM users WHERE email = ${email.trim().toLowerCase()}`;
  if (rows.length === 0) return res.status(401).json({ error: "Invalid email or password" });

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  const userData = { id: Number(user.id), name: user.name, email: user.email };
  res.json({ token: signToken(userData), user: userData });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const sql = getSQL();
  const rows = await sql`SELECT id, name, email FROM users WHERE id = ${req.user.id}`;
  if (rows.length === 0) return res.status(401).json({ error: "User not found" });
  const u = rows[0];
  res.json({ id: Number(u.id), name: u.name, email: u.email });
});

// ── Protected routes ──

// GET /api/todos
app.get("/api/todos", requireAuth, async (req, res) => {
  const sql = getSQL();
  const todos = await sql`SELECT * FROM todos WHERE user_id = ${req.user.id} ORDER BY created_at`;
  const todoIds = todos.map(t => Number(t.id));
  const attachments = todoIds.length > 0
    ? await sql`SELECT * FROM attachments WHERE todo_id = ANY(${todoIds})`
    : [];

  res.json(todos.map(t => ({
    id: Number(t.id),
    parentId: t.parent_id ? Number(t.parent_id) : null,
    folderId: t.folder_id ? Number(t.folder_id) : null,
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
app.post("/api/todos", requireAuth, async (req, res) => {
  const { title, description, dueDate, parentId, status, folderId } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });

  const sql = getSQL();
  const id = Date.now();
  const validStatus = ["pending", "in-progress", "done"].includes(status) ? status : "pending";
  const pId = parentId != null ? Number(parentId) : null;
  const fId = folderId != null ? Number(folderId) : null;

  if (pId != null) {
    const rows = await sql`SELECT id FROM todos WHERE id = ${pId} AND user_id = ${req.user.id}`;
    if (rows.length === 0) return res.status(400).json({ error: "Parent not found" });
  }

  await sql`
    INSERT INTO todos (id, user_id, parent_id, folder_id, title, description, status, due_date)
    VALUES (${id}, ${req.user.id}, ${pId}, ${fId}, ${title.trim()}, ${(description || "").trim()}, ${validStatus}, ${dueDate || null})
  `;

  const todo = {
    id,
    parentId: pId,
    folderId: fId,
    title: title.trim(),
    description: (description || "").trim(),
    status: validStatus,
    dueDate: dueDate || null,
    attachments: []
  };

  sendNewTodoEmail(todo, req.user.email);

  res.status(201).json(todo);
});

// PUT /api/todos/:id
app.put("/api/todos/:id", requireAuth, async (req, res) => {
  const sql = getSQL();
  const id = Number(req.params.id);
  const rows = await sql`SELECT * FROM todos WHERE id = ${id} AND user_id = ${req.user.id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });

  const todo = rows[0];
  const title = req.body.title !== undefined ? req.body.title.trim() : todo.title;
  const description = req.body.description !== undefined ? req.body.description.trim() : (todo.description || "");
  const status = req.body.status !== undefined ? req.body.status : todo.status;
  const dueDate = req.body.dueDate !== undefined ? req.body.dueDate : todo.due_date;
  const folderId = req.body.folderId !== undefined ? (req.body.folderId != null ? Number(req.body.folderId) : null) : (todo.folder_id || null);

  await sql`
    UPDATE todos SET title = ${title}, description = ${description}, status = ${status}, due_date = ${dueDate}, folder_id = ${folderId}
    WHERE id = ${id} AND user_id = ${req.user.id}
  `;

  const atts = await sql`SELECT * FROM attachments WHERE todo_id = ${id}`;

  res.json({
    id,
    parentId: todo.parent_id ? Number(todo.parent_id) : null,
    folderId: folderId ? Number(folderId) : null,
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
app.delete("/api/todos/:id", requireAuth, async (req, res) => {
  const sql = getSQL();
  const id = Number(req.params.id);
  const cascade = req.query.cascade !== "false";

  const rows = await sql`SELECT * FROM todos WHERE id = ${id} AND user_id = ${req.user.id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });
  const todo = rows[0];

  if (cascade) {
    const atts = await sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id} AND user_id = ${req.user.id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
      SELECT blob_url FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
    `;
    for (const a of atts) {
      try { await del(a.blob_url); } catch (e) { /* ignore */ }
    }

    await sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id} AND user_id = ${req.user.id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
      DELETE FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
    `;
    await sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id} AND user_id = ${req.user.id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
      DELETE FROM todos WHERE id IN (SELECT id FROM descendants)
    `;
  } else {
    const newParent = todo.parent_id || null;
    await sql`UPDATE todos SET parent_id = ${newParent} WHERE parent_id = ${id} AND user_id = ${req.user.id}`;

    const atts = await sql`SELECT blob_url FROM attachments WHERE todo_id = ${id}`;
    for (const a of atts) {
      try { await del(a.blob_url); } catch (e) { /* ignore */ }
    }

    await sql`DELETE FROM attachments WHERE todo_id = ${id}`;
    await sql`DELETE FROM todos WHERE id = ${id} AND user_id = ${req.user.id}`;
  }

  res.status(204).end();
});

// ── Folder endpoints ──

// GET /api/folders
app.get("/api/folders", requireAuth, async (req, res) => {
  const sql = getSQL();
  const folders = await sql`SELECT * FROM folders WHERE user_id = ${req.user.id} ORDER BY created_at`;
  res.json(folders.map(f => ({
    id: Number(f.id),
    name: f.name,
    color: f.color
  })));
});

// POST /api/folders
app.post("/api/folders", requireAuth, async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: "Folder name is required" });

  const sql = getSQL();
  const id = Date.now();
  const folderColor = color || "#6366f1";

  await sql`
    INSERT INTO folders (id, user_id, name, color)
    VALUES (${id}, ${req.user.id}, ${name.trim()}, ${folderColor})
  `;

  res.status(201).json({ id, name: name.trim(), color: folderColor });
});

// PUT /api/folders/:id
app.put("/api/folders/:id", requireAuth, async (req, res) => {
  const sql = getSQL();
  const id = Number(req.params.id);
  const rows = await sql`SELECT * FROM folders WHERE id = ${id} AND user_id = ${req.user.id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Folder not found" });

  const folder = rows[0];
  const name = req.body.name !== undefined ? req.body.name.trim() : folder.name;
  const color = req.body.color !== undefined ? req.body.color : folder.color;

  if (!name) return res.status(400).json({ error: "Folder name is required" });

  await sql`
    UPDATE folders SET name = ${name}, color = ${color}
    WHERE id = ${id} AND user_id = ${req.user.id}
  `;

  res.json({ id, name, color });
});

// DELETE /api/folders/:id?action=delete|move
app.delete("/api/folders/:id", requireAuth, async (req, res) => {
  const sql = getSQL();
  const id = Number(req.params.id);
  const action = req.query.action || "move"; // "delete" = delete all todos, "move" = move to default

  const rows = await sql`SELECT * FROM folders WHERE id = ${id} AND user_id = ${req.user.id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Folder not found" });

  if (action === "delete") {
    // Delete all todos in this folder (and their descendants/attachments)
    const folderTodos = await sql`SELECT id FROM todos WHERE folder_id = ${id} AND user_id = ${req.user.id}`;
    for (const ft of folderTodos) {
      const todoId = Number(ft.id);
      const atts = await sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id}
          UNION ALL
          SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
        )
        SELECT blob_url FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
      `;
      for (const a of atts) {
        try { await del(a.blob_url); } catch (e) { /* ignore */ }
      }
      await sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id}
          UNION ALL
          SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
        )
        DELETE FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
      `;
      await sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id}
          UNION ALL
          SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
        )
        DELETE FROM todos WHERE id IN (SELECT id FROM descendants)
      `;
    }
  } else {
    // Move all todos in this folder to default (null)
    await sql`UPDATE todos SET folder_id = NULL WHERE folder_id = ${id} AND user_id = ${req.user.id}`;
  }

  await sql`DELETE FROM folders WHERE id = ${id} AND user_id = ${req.user.id}`;
  res.status(204).end();
});

// POST /api/todos/:id/attachments
app.post("/api/todos/:id/attachments", requireAuth, upload.array("files", 10), async (req, res) => {
  const sql = getSQL();
  const todoId = Number(req.params.id);
  const rows = await sql`SELECT id FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id}`;
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
app.delete("/api/todos/:id/attachments/:attId", requireAuth, async (req, res) => {
  const sql = getSQL();
  // Verify the todo belongs to the user
  const todoRows = await sql`SELECT id FROM todos WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`;
  if (todoRows.length === 0) return res.status(404).json({ error: "Not found" });

  const rows = await sql`SELECT * FROM attachments WHERE id = ${req.params.attId} AND todo_id = ${Number(req.params.id)}`;
  if (rows.length === 0) return res.status(404).json({ error: "Attachment not found" });

  try { await del(rows[0].blob_url); } catch (e) { /* ignore */ }
  await sql`DELETE FROM attachments WHERE id = ${req.params.attId}`;
  res.status(204).end();
});

module.exports = app;
