"use client";

import { createContext, useContext } from "react";
import type { Todo, User } from "@/lib/types";
import type { TodoStatus } from "@/lib/schemas";

export interface TodosState {
  todos: Todo[];
  user: User;
  filter: TodoStatus | "all";
  viewMode: "list" | "board";
  collapsed: Set<number>;
  loading: boolean;
  setFilter: (filter: TodoStatus | "all") => void;
  setViewMode: (mode: "list" | "board") => void;
  toggleCollapse: (id: number) => void;
  refresh: () => Promise<void>;
}

export const TodosContext = createContext<TodosState | null>(null);

export function useTodos() {
  const ctx = useContext(TodosContext);
  if (!ctx) throw new Error("useTodos must be used within TodosProvider");
  return ctx;
}

// ── Tree helpers ──

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

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
