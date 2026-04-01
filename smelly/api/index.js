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
        CREATE TABLE IF NOT EXISTS todo_shares (
          id BIGINT PRIMARY KEY,
          todo_id BIGINT NOT NULL,
          owner_id BIGINT NOT NULL,
          invitee_email TEXT NOT NULL,
          invitee_id BIGINT,
          role TEXT NOT NULL DEFAULT 'viewer',
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL
        )
      `;
      // Migrate existing tables: add user_id if missing
      try {
        await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS user_id BIGINT`;
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

  const ownTodos = todos.map(t => ({
    id: Number(t.id),
    parentId: t.parent_id ? Number(t.parent_id) : null,
    title: t.title,
    description: t.description || "",
    status: t.status,
    dueDate: t.due_date || null,
    isShared: false,
    ownerName: null,
    shareRole: null,
    attachments: attachments
      .filter(a => Number(a.todo_id) === Number(t.id))
      .map(a => ({
        id: a.id,
        url: a.blob_url,
        originalName: a.original_name,
        size: Number(a.size)
      }))
  }));

  // Fetch accepted shared todos
  const sharedRoots = await sql`
    SELECT ts.role, ts.todo_id, u.name as owner_name
    FROM todo_shares ts
    JOIN users u ON u.id = ts.owner_id
    WHERE ts.invitee_id = ${req.user.id} AND ts.status = 'accepted'
  `;

  let sharedTodos = [];
  for (const share of sharedRoots) {
    const stodos = await sql`
      WITH RECURSIVE tree AS (
        SELECT * FROM todos WHERE id = ${share.todo_id}
        UNION ALL
        SELECT t.* FROM todos t INNER JOIN tree tr ON t.parent_id = tr.id
      )
      SELECT * FROM tree ORDER BY created_at
    `;
    const sIds = stodos.map(t => Number(t.id));
    const sAtts = sIds.length > 0
      ? await sql`SELECT * FROM attachments WHERE todo_id = ANY(${sIds})`
      : [];

    for (const t of stodos) {
      sharedTodos.push({
        id: Number(t.id),
        parentId: t.parent_id ? Number(t.parent_id) : null,
        title: t.title,
        description: t.description || "",
        status: t.status,
        dueDate: t.due_date || null,
        isShared: true,
        ownerName: share.owner_name,
        shareRole: share.role,
        attachments: sAtts
          .filter(a => Number(a.todo_id) === Number(t.id))
          .map(a => ({
            id: a.id,
            url: a.blob_url,
            originalName: a.original_name,
            size: Number(a.size)
          }))
      });
    }
  }

  res.json([...ownTodos, ...sharedTodos]);
});

// POST /api/todos
app.post("/api/todos", requireAuth, async (req, res) => {
  const { title, description, dueDate, parentId, status } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });

  const sql = getSQL();
  const id = Date.now();
  const validStatus = ["pending", "in-progress", "done"].includes(status) ? status : "pending";
  const pId = parentId != null ? Number(parentId) : null;

  if (pId != null) {
    const rows = await sql`SELECT id FROM todos WHERE id = ${pId} AND user_id = ${req.user.id}`;
    if (rows.length === 0) return res.status(400).json({ error: "Parent not found" });
  }

  await sql`
    INSERT INTO todos (id, user_id, parent_id, title, description, status, due_date)
    VALUES (${id}, ${req.user.id}, ${pId}, ${title.trim()}, ${(description || "").trim()}, ${validStatus}, ${dueDate || null})
  `;

  const todo = {
    id,
    parentId: pId,
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

  // Check ownership first
  let rows = await sql`SELECT * FROM todos WHERE id = ${id} AND user_id = ${req.user.id}`;
  let isOwner = rows.length > 0;

  // If not owner, check for editor share on the root ancestor
  if (!isOwner) {
    rows = await sql`SELECT * FROM todos WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });

    // Walk up to root
    let current = rows[0];
    while (current.parent_id) {
      const parent = await sql`SELECT * FROM todos WHERE id = ${current.parent_id}`;
      if (parent.length === 0) break;
      current = parent[0];
    }
    const rootId = Number(current.id);

    const share = await sql`
      SELECT role FROM todo_shares
      WHERE todo_id = ${rootId} AND invitee_id = ${req.user.id} AND status = 'accepted'
    `;
    if (share.length === 0 || share[0].role !== "editor") {
      return res.status(403).json({ error: "Not authorized to edit this todo" });
    }
  }

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

// ── Share endpoints ──

// POST /api/todos/:id/shares – invite a collaborator
app.post("/api/todos/:id/shares", requireAuth, async (req, res) => {
  const sql = getSQL();
  const todoId = Number(req.params.id);
  const { email, role } = req.body;

  if (!email || !email.trim()) return res.status(400).json({ error: "Email is required" });
  if (!["viewer", "editor"].includes(role)) return res.status(400).json({ error: "Role must be viewer or editor" });

  // Must be a root todo owned by current user
  const rows = await sql`SELECT * FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id} AND parent_id IS NULL`;
  if (rows.length === 0) return res.status(404).json({ error: "Root todo not found" });

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === req.user.email) return res.status(400).json({ error: "Cannot share with yourself" });

  // Check for existing active share
  const existing = await sql`
    SELECT id FROM todo_shares
    WHERE todo_id = ${todoId} AND invitee_email = ${normalizedEmail}
    AND (status = 'accepted' OR (status = 'pending' AND expires_at > NOW()))
  `;
  if (existing.length > 0) return res.status(409).json({ error: "Already shared with this user" });

  // Look up invitee
  const inviteeRows = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
  const inviteeId = inviteeRows.length > 0 ? Number(inviteeRows[0].id) : null;

  const id = Date.now();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await sql`
    INSERT INTO todo_shares (id, todo_id, owner_id, invitee_email, invitee_id, role, status, expires_at)
    VALUES (${id}, ${todoId}, ${req.user.id}, ${normalizedEmail}, ${inviteeId}, ${role}, 'pending', ${expiresAt})
  `;

  // Send invite email
  try {
    await mailTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: normalizedEmail,
      subject: `${req.user.name} shared a todo with you`,
      text: [
        `${req.user.name} has shared "${rows[0].title}" with you as ${role === "editor" ? "an editor" : "a viewer"}.`,
        ``,
        `Log in to Taskflow to view it. This invite expires in 10 minutes.`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("Failed to send share invite email:", err.message);
  }

  res.status(201).json({ id, todoId, email: normalizedEmail, role, status: "pending", expiresAt });
});

// GET /api/todos/:id/shares – list shares for a todo (owner only)
app.get("/api/todos/:id/shares", requireAuth, async (req, res) => {
  const sql = getSQL();
  const todoId = Number(req.params.id);

  const rows = await sql`SELECT id FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });

  const shares = await sql`
    SELECT id, invitee_email, role, status, created_at, expires_at
    FROM todo_shares
    WHERE todo_id = ${todoId} AND owner_id = ${req.user.id}
    AND (status = 'accepted' OR (status = 'pending' AND expires_at > NOW()))
    ORDER BY created_at DESC
  `;

  res.json(shares.map(s => ({
    id: Number(s.id),
    email: s.invitee_email,
    role: s.role,
    status: s.status,
    createdAt: s.created_at,
    expiresAt: s.expires_at
  })));
});

// DELETE /api/shares/:shareId – revoke a share (owner only)
app.delete("/api/shares/:shareId", requireAuth, async (req, res) => {
  const sql = getSQL();
  const shareId = Number(req.params.shareId);

  const rows = await sql`SELECT * FROM todo_shares WHERE id = ${shareId} AND owner_id = ${req.user.id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Share not found" });

  await sql`DELETE FROM todo_shares WHERE id = ${shareId}`;
  res.status(204).end();
});

// POST /api/shares/:shareId/accept – accept a pending invite
app.post("/api/shares/:shareId/accept", requireAuth, async (req, res) => {
  const sql = getSQL();
  const shareId = Number(req.params.shareId);

  const rows = await sql`
    SELECT * FROM todo_shares
    WHERE id = ${shareId} AND invitee_email = ${req.user.email}
    AND status = 'pending' AND expires_at > NOW()
  `;
  if (rows.length === 0) return res.status(404).json({ error: "Invite not found or expired" });

  await sql`UPDATE todo_shares SET status = 'accepted', invitee_id = ${req.user.id} WHERE id = ${shareId}`;
  res.json({ status: "accepted" });
});

// POST /api/shares/:shareId/decline – decline a pending invite
app.post("/api/shares/:shareId/decline", requireAuth, async (req, res) => {
  const sql = getSQL();
  const shareId = Number(req.params.shareId);

  const rows = await sql`
    SELECT * FROM todo_shares
    WHERE id = ${shareId} AND invitee_email = ${req.user.email}
    AND status = 'pending' AND expires_at > NOW()
  `;
  if (rows.length === 0) return res.status(404).json({ error: "Invite not found or expired" });

  await sql`DELETE FROM todo_shares WHERE id = ${shareId}`;
  res.status(204).end();
});

// GET /api/pending-invites – list pending invites for the current user
app.get("/api/pending-invites", requireAuth, async (req, res) => {
  const sql = getSQL();

  const invites = await sql`
    SELECT ts.id, ts.todo_id, ts.role, ts.expires_at, t.title as todo_title, u.name as owner_name
    FROM todo_shares ts
    JOIN todos t ON t.id = ts.todo_id
    JOIN users u ON u.id = ts.owner_id
    WHERE ts.invitee_email = ${req.user.email} AND ts.status = 'pending' AND ts.expires_at > NOW()
    ORDER BY ts.created_at DESC
  `;

  res.json(invites.map(i => ({
    id: Number(i.id),
    todoId: Number(i.todo_id),
    todoTitle: i.todo_title,
    ownerName: i.owner_name,
    role: i.role,
    expiresAt: i.expires_at
  })));
});

module.exports = app;
