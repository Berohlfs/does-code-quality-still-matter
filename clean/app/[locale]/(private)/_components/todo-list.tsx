"use client";

import { useTranslations } from "next-intl";
import { useTodos } from "@/app/[locale]/(private)/_hooks/use-todos";
import { getRootTodos, getAllDescendants } from "@/app/[locale]/(private)/_helpers/todos";
import { useDashboard } from "./dashboard-context";
import { TodoItem } from "./todo-item";
import type { TodoDto } from "@/dto/todo";
import { ClipboardList } from "lucide-react";

const EMPTY_STATE_KEYS: Record<string, string> = {
  all: "noTasksAll",
  pending: "noTasksPending",
  "in-progress": "noTasksInProgress",
  done: "noTasksDone",
};

interface TodoListProps {
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
}

export function TodoList({ onEdit, onDelete, onAddSubtask }: TodoListProps) {
  const t = useTranslations("dashboard");
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
    return (
      <div className="flex flex-col items-center py-16 text-muted-foreground">
        <ClipboardList className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">{t(EMPTY_STATE_KEYS[filter])}</p>
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
        />
      ))}
    </ul>
  );
}
