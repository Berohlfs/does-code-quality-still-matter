"use client";

import { useTodos } from "@/app/(private)/_hooks/use-todos";
import { getRootTodos, getAllDescendants } from "@/app/(private)/_helpers/todos";
import { useDashboard } from "./dashboard-context";
import { TodoItem } from "./todo-item";
import type { TodoDto } from "@/dto/todo";
import { ClipboardList } from "lucide-react";

interface TodoListProps {
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
  onShare: (todo: TodoDto) => void;
}

export function TodoList({ onEdit, onDelete, onAddSubtask, onShare }: TodoListProps) {
  const { data: todos = [] } = useTodos();
  const { filter } = useDashboard();

  let rootItems = getRootTodos(todos);

  if (filter !== "all") {
    rootItems = rootItems.filter(
      (t) =>
        t.status === filter ||
        getAllDescendants(todos, t.id).some((d) => d.status === filter)
    );
  }

  if (rootItems.length === 0) {
    const label =
      filter === "all"
        ? ""
        : (filter === "in-progress" ? "in progress " : filter + " ");

    return (
      <div className="flex flex-col items-center py-16 text-muted-foreground">
        <ClipboardList className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">No {label}tasks yet</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2 pb-20">
      {rootItems.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
          onShare={onShare}
        />
      ))}
    </ul>
  );
}
