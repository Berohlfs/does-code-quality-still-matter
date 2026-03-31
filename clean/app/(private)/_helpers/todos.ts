import type { TodoDto as Todo } from "@/dto/todo";

export function getChildren(todos: Todo[], parentId: number) {
  return todos.filter((t) => t.parentId === parentId);
}

export function getRootTodos(todos: Todo[]) {
  return todos.filter((t) => !t.parentId);
}

export function getAllDescendants(todos: Todo[], parentId: number): Todo[] {
  const children = getChildren(todos, parentId);
  const all = [...children];
  for (const c of children) all.push(...getAllDescendants(todos, c.id));
  return all;
}

export function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate || todo.status === "done") return false;
  return new Date(todo.dueDate + "T23:59:59") < new Date();
}
