const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "todos.json");

app.use(express.json());
app.use(express.static(__dirname));

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
    dueDate: dueDate || null
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
  const len = todos.length;
  todos = todos.filter(t => t.id !== Number(req.params.id));
  if (todos.length === len) return res.status(404).json({ error: "Not found" });
  writeTodos(todos);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
