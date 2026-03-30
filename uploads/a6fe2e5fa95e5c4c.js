const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "todos.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(__dirname));
app.use("/uploads", express.static(UPLOADS_DIR));

function readTodos() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function writeTodos(todos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2));
}

app.get("/api/todos", (req, res) => {
  res.json(readTodos());
});

app.post("/api/todos", (req, res) => {
  const { title, description, dueDate } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: "Title is required" });
  const todos = readTodos();
  const todo = {
    id: Date.now(),
    title: title.trim(),
    description: (description || "").trim(),
    status: ["pending", "in-progress", "done"].includes(req.body.status) ? req.body.status : "pending",
    dueDate: dueDate || null,
    attachments: []
  };
  todos.push(todo);
  writeTodos(todos);
  res.status(201).json(todo);
});

app.put("/api/todos/:id", (req, res) => {
  const todos = readTodos();
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: "Not found" });
  if (req.body.title !== undefined) todo.title = req.body.title.trim();
  if (req.body.description !== undefined) todo.description = req.body.description.trim();
  if (req.body.status !== undefined) todo.status = req.body.status;
  if (req.body.dueDate !== undefined) todo.dueDate = req.body.dueDate;
  writeTodos(todos);
  res.json(todo);
});

app.delete("/api/todos/:id", (req, res) => {
  let todos = readTodos();
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: "Not found" });
  // Clean up attachment files
  if (todo.attachments) {
    for (const att of todo.attachments) {
      const fp = path.join(UPLOADS_DIR, att.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  }
  todos = todos.filter(t => t.id !== todo.id);
  writeTodos(todos);
  res.status(204).end();
});

// Upload attachments to a todo
app.post("/api/todos/:id/attachments", upload.array("files", 10), (req, res) => {
  const todos = readTodos();
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: "Not found" });
  if (!todo.attachments) todo.attachments = [];
  const added = req.files.map(f => ({
    id: crypto.randomBytes(6).toString("hex"),
    filename: f.filename,
    originalName: f.originalname,
    size: f.size
  }));
  todo.attachments.push(...added);
  writeTodos(todos);
  res.json(added);
});

// Delete a single attachment
app.delete("/api/todos/:id/attachments/:attId", (req, res) => {
  const todos = readTodos();
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: "Todo not found" });
  if (!todo.attachments) return res.status(404).json({ error: "Attachment not found" });
  const idx = todo.attachments.findIndex(a => a.id === req.params.attId);
  if (idx === -1) return res.status(404).json({ error: "Attachment not found" });
  const [att] = todo.attachments.splice(idx, 1);
  const fp = path.join(UPLOADS_DIR, att.filename);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  writeTodos(todos);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
