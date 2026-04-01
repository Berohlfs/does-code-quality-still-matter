"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { TodoStatus } from "@/dto/todo";

interface DashboardState {
  filter: TodoStatus | "all";
  viewMode: "list" | "board";
  collapsed: Set<number>;
  setFilter: (filter: TodoStatus | "all") => void;
  setViewMode: (mode: "list" | "board") => void;
  toggleCollapse: (id: number) => void;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx)
    throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<TodoStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggleCollapse = useCallback((id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ filter, viewMode, collapsed, setFilter, setViewMode, toggleCollapse }),
    [filter, viewMode, collapsed, toggleCollapse]
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
