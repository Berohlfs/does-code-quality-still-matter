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
          shared_with_email TEXT NOT NULL,
          shared_with_id BIGINT,
          role TEXT NOT NULL DEFAULT 'viewer',
          token TEXT UNIQUE NOT NULL,
          accepted_at TIMESTAMPTZ,
          revoked BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
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

// ── Share access helpers ──

// Find the root ancestor of a todo (for checking share permissions on subtasks)
async function findRootTodoId(sql, todoId) {
  const rows = await sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM todos WHERE id = ${todoId}
      UNION ALL
      SELECT t.id, t.parent_id FROM todos t INNER JOIN ancestors a ON t.id = a.parent_id
    )
    SELECT id FROM ancestors WHERE parent_id IS NULL
  `;
  return rows.length > 0 ? Number(rows[0].id) : todoId;
}

// Check if a user has a specific role (or any accepted share) on a todo
async function getShareRole(sql, todoId, userId) {
  const rootId = await findRootTodoId(sql, todoId);
  const rows = await sql`
    SELECT role FROM todo_shares
    WHERE todo_id = ${rootId} AND shared_with_id = ${userId}
      AND accepted_at IS NOT NULL AND revoked = FALSE
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0].role : null;
}

// ── Protected routes ──

// GET /api/todos
app.get("/api/todos", requireAuth, async (req, res) => {
  const sql = getSQL();

  // Own todos
  const ownTodos = await sql`SELECT * FROM todos WHERE user_id = ${req.user.id} ORDER BY created_at`;

  // Shared todos: find accepted, non-revoked shares for this user
  const sharedRoots = await sql`
    SELECT s.todo_id, s.role, s.owner_id, u.name as owner_name
    FROM todo_shares s
    JOIN users u ON s.owner_id = u.id
    WHERE s.shared_with_id = ${req.user.id}
      AND s.accepted_at IS NOT NULL
      AND s.revoked = FALSE
  `;

  let sharedTodos = [];
  const shareMap = {}; // todoId -> { role, ownerName, ownerId }
  if (sharedRoots.length > 0) {
    const sharedRootIds = sharedRoots.map(s => Number(s.todo_id));
    for (const s of sharedRoots) {
      shareMap[Number(s.todo_id)] = { role: s.role, ownerName: s.owner_name, ownerId: Number(s.owner_id) };
    }

    // Get the shared root todos and all their descendants
    sharedTodos = await sql`
      WITH RECURSIVE tree AS (
        SELECT * FROM todos WHERE id = ANY(${sharedRootIds})
        UNION ALL
        SELECT t.* FROM todos t INNER JOIN tree tr ON t.parent_id = tr.id
      )
      SELECT * FROM tree ORDER BY created_at
    `;

    // Map all descendants to the same share info as their root (top-down)
    // Process in order so parents are mapped before children
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of sharedTodos) {
        const tid = Number(t.id);
        if (!shareMap[tid] && t.parent_id && shareMap[Number(t.parent_id)]) {
          shareMap[tid] = shareMap[Number(t.parent_id)];
          changed = true;
        }
      }
    }
  }

  const allTodos = [...ownTodos, ...sharedTodos];
  const todoIds = allTodos.map(t => Number(t.id));
  const attachments = todoIds.length > 0
    ? await sql`SELECT * FROM attachments WHERE todo_id = ANY(${todoIds})`
    : [];

  res.json(allTodos.map(t => {
    const tid = Number(t.id);
    const share = shareMap[tid];
    return {
      id: tid,
      parentId: t.parent_id ? Number(t.parent_id) : null,
      title: t.title,
      description: t.description || "",
      status: t.status,
      dueDate: t.due_date || null,
      shared: share ? true : false,
      shareRole: share ? share.role : null,
      ownerName: share ? share.ownerName : null,
      attachments: attachments
        .filter(a => Number(a.todo_id) === tid)
        .map(a => ({
          id: a.id,
          url: a.blob_url,
          originalName: a.original_name,
          size: Number(a.size)
        }))
    };
  }));
});

// POST /api/todos
app.post("/api/todos", requireAuth, async (req, res) => {
  const { title, description, dueDate, parentId, status } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });

  const sql = getSQL();
  const id = Date.now();
  const validStatus = ["pending", "in-progress", "done"].includes(status) ? status : "pending";
  const pId = parentId != null ? Number(parentId) : null;
  let todoOwnerId = req.user.id;

  if (pId != null) {
    const rows = await sql`SELECT id, user_id FROM todos WHERE id = ${pId} AND user_id = ${req.user.id}`;
    if (rows.length === 0) {
      // Check if user has editor access via sharing
      const parentRows = await sql`SELECT id, user_id FROM todos WHERE id = ${pId}`;
      if (parentRows.length === 0) return res.status(400).json({ error: "Parent not found" });
      const role = await getShareRole(sql, pId, req.user.id);
      if (role !== "editor") return res.status(403).json({ error: "Not authorized to add subtasks" });
      // Subtask belongs to the original todo owner
      todoOwnerId = Number(parentRows[0].user_id);
    }
  }

  await sql`
    INSERT INTO todos (id, user_id, parent_id, title, description, status, due_date)
    VALUES (${id}, ${todoOwnerId}, ${pId}, ${title.trim()}, ${(description || "").trim()}, ${validStatus}, ${dueDate || null})
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
  let rows = await sql`SELECT * FROM todos WHERE id = ${id} AND user_id = ${req.user.id}`;

  // If not owned, check for editor share access
  if (rows.length === 0) {
    rows = await sql`SELECT * FROM todos WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const role = await getShareRole(sql, id, req.user.id);
    if (role !== "editor") return res.status(403).json({ error: role === "viewer" ? "Viewers cannot edit" : "Not found" });
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
  let rows = await sql`SELECT id FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id}`;
  if (rows.length === 0) {
    rows = await sql`SELECT id FROM todos WHERE id = ${todoId}`;
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const role = await getShareRole(sql, todoId, req.user.id);
    if (role !== "editor") return res.status(403).json({ error: "Not authorized" });
  }

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
  // Verify the todo belongs to the user or they have editor access
  let todoRows = await sql`SELECT id FROM todos WHERE id = ${Number(req.params.id)} AND user_id = ${req.user.id}`;
  if (todoRows.length === 0) {
    todoRows = await sql`SELECT id FROM todos WHERE id = ${Number(req.params.id)}`;
    if (todoRows.length === 0) return res.status(404).json({ error: "Not found" });
    const role = await getShareRole(sql, Number(req.params.id), req.user.id);
    if (role !== "editor") return res.status(403).json({ error: "Not authorized" });
  }

  const rows = await sql`SELECT * FROM attachments WHERE id = ${req.params.attId} AND todo_id = ${Number(req.params.id)}`;
  if (rows.length === 0) return res.status(404).json({ error: "Attachment not found" });

  try { await del(rows[0].blob_url); } catch (e) { /* ignore */ }
  await sql`DELETE FROM attachments WHERE id = ${req.params.attId}`;
  res.status(204).end();
});

// ── Sharing endpoints ──

// POST /api/todos/:id/shares – invite a collaborator
app.post("/api/todos/:id/shares", requireAuth, async (req, res) => {
  const sql = getSQL();
  const todoId = Number(req.params.id);
  const { email, role } = req.body;

  if (!email || !email.trim()) return res.status(400).json({ error: "Email is required" });
  if (!["viewer", "editor"].includes(role)) return res.status(400).json({ error: "Role must be viewer or editor" });

  // Only the todo owner can share, and it must be a root-level todo
  const rows = await sql`SELECT * FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });
  if (rows[0].parent_id) return res.status(400).json({ error: "Only root todos can be shared directly; subitems are included automatically" });

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === req.user.email) return res.status(400).json({ error: "Cannot share with yourself" });

  // Check for existing active share with the same email
  const existing = await sql`
    SELECT id FROM todo_shares
    WHERE todo_id = ${todoId} AND shared_with_email = ${normalizedEmail} AND revoked = FALSE
  `;
  if (existing.length > 0) return res.status(409).json({ error: "Already shared with this email" });

  const id = Date.now();
  const token = crypto.randomBytes(24).toString("hex");

  // Check if the invited user already has an account
  const userRows = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
  const sharedWithId = userRows.length > 0 ? Number(userRows[0].id) : null;

  await sql`
    INSERT INTO todo_shares (id, todo_id, owner_id, shared_with_email, shared_with_id, role, token)
    VALUES (${id}, ${todoId}, ${req.user.id}, ${normalizedEmail}, ${sharedWithId}, ${role}, ${token})
  `;

  // Send invite email
  try {
    await mailTransporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: normalizedEmail,
      subject: `${req.user.name} shared a todo with you`,
      text: [
        `${req.user.name} has shared a todo "${rows[0].title}" with you as ${role === "editor" ? "an editor" : "a viewer"}.`,
        ``,
        `This invite expires in 10 minutes.`,
        ``,
        `Open Taskflow and accept the invite to get started.`,
      ].join("\n"),
    });
  } catch (err) {
    console.error("Failed to send share invite email:", err.message);
  }

  res.status(201).json({
    id, todoId, email: normalizedEmail, role, token,
    createdAt: new Date().toISOString(),
    expired: false, accepted: false
  });
});

// GET /api/todos/:id/shares – list shares for a todo (owner only)
app.get("/api/todos/:id/shares", requireAuth, async (req, res) => {
  const sql = getSQL();
  const todoId = Number(req.params.id);

  const rows = await sql`SELECT id FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });

  const shares = await sql`
    SELECT * FROM todo_shares WHERE todo_id = ${todoId} AND revoked = FALSE ORDER BY created_at DESC
  `;

  const now = new Date();
  res.json(shares.map(s => ({
    id: Number(s.id),
    todoId: Number(s.todo_id),
    email: s.shared_with_email,
    role: s.role,
    token: s.token,
    createdAt: s.created_at,
    accepted: !!s.accepted_at,
    expired: !s.accepted_at && (now - new Date(s.created_at)) > 10 * 60 * 1000
  })));
});

// DELETE /api/todos/:id/shares/:shareId – revoke a share (owner only)
app.delete("/api/todos/:id/shares/:shareId", requireAuth, async (req, res) => {
  const sql = getSQL();
  const todoId = Number(req.params.id);
  const shareId = Number(req.params.shareId);

  const rows = await sql`SELECT id FROM todos WHERE id = ${todoId} AND user_id = ${req.user.id}`;
  if (rows.length === 0) return res.status(404).json({ error: "Not found" });

  const shareRows = await sql`SELECT id FROM todo_shares WHERE id = ${shareId} AND todo_id = ${todoId} AND revoked = FALSE`;
  if (shareRows.length === 0) return res.status(404).json({ error: "Share not found" });

  await sql`UPDATE todo_shares SET revoked = TRUE WHERE id = ${shareId}`;
  res.status(204).end();
});

// POST /api/shares/accept/:token – accept an invite
app.post("/api/shares/accept/:token", requireAuth, async (req, res) => {
  const sql = getSQL();
  const { token } = req.params;

  const rows = await sql`SELECT * FROM todo_shares WHERE token = ${token} AND revoked = FALSE`;
  if (rows.length === 0) return res.status(404).json({ error: "Invite not found or revoked" });

  const share = rows[0];

  if (share.accepted_at) return res.status(400).json({ error: "Invite already accepted" });

  // Check expiry (10 minutes)
  const elapsed = Date.now() - new Date(share.created_at).getTime();
  if (elapsed > 10 * 60 * 1000) return res.status(410).json({ error: "Invite has expired" });

  // Verify the accepting user's email matches the invite
  if (req.user.email !== share.shared_with_email) {
    return res.status(403).json({ error: "This invite was sent to a different email address" });
  }

  await sql`UPDATE todo_shares SET accepted_at = NOW(), shared_with_id = ${req.user.id} WHERE id = ${share.id}`;

  res.json({ message: "Invite accepted", todoId: Number(share.todo_id), role: share.role });
});

// GET /api/shares/pending – list pending invites for current user
app.get("/api/shares/pending", requireAuth, async (req, res) => {
  const sql = getSQL();
  const shares = await sql`
    SELECT s.*, t.title as todo_title, u.name as owner_name
    FROM todo_shares s
    JOIN todos t ON s.todo_id = t.id
    JOIN users u ON s.owner_id = u.id
    WHERE s.shared_with_email = ${req.user.email}
      AND s.revoked = FALSE
      AND s.accepted_at IS NULL
    ORDER BY s.created_at DESC
  `;

  const now = Date.now();
  res.json(shares.filter(s => (now - new Date(s.created_at).getTime()) <= 10 * 60 * 1000).map(s => ({
    id: Number(s.id),
    todoId: Number(s.todo_id),
    todoTitle: s.todo_title,
    ownerName: s.owner_name,
    role: s.role,
    token: s.token,
    createdAt: s.created_at
  })));
});

module.exports = app;
