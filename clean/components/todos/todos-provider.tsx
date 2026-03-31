"use client";

import { useState, useCallback, useMemo, type ReactNode } from "react";
import { TodosContext } from "@/hooks/use-todos";
import type { Todo, User } from "@/lib/types";
import type { TodoStatus } from "@/lib/schemas";
import { fetchTodos as apiFetchTodos } from "@/lib/api";

interface TodosProviderProps {
  children: ReactNode;
  initialTodos: Todo[];
  user: User;
}

export function TodosProvider({
  children,
  initialTodos,
  user,
}: TodosProviderProps) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [filter, setFilter] = useState<TodoStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const toggleCollapse = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchTodos();
      setTodos(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      todos,
      user,
      filter,
      viewMode,
      collapsed,
      loading,
      setFilter,
      setViewMode,
      toggleCollapse,
      refresh,
    }),
    [todos, user, filter, viewMode, collapsed, loading, toggleCollapse, refresh]
  );

  return (
    <TodosContext.Provider value={value}>{children}</TodosContext.Provider>
  );
}
