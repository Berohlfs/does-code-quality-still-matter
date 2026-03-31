"use client";

import { useDashboard } from "./dashboard-context";
import { Switch } from "@/components/ui/switch";
import type { TodoStatus } from "../_validations/todo-status";

const FILTERS: Array<{ value: TodoStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const FILTER_LABELS: Record<string, string> = {
  all: "All Tasks",
  pending: "Pending Tasks",
  "in-progress": "In Progress",
  done: "Completed",
};

export function Toolbar() {
  const { filter, setFilter, viewMode, setViewMode } = useDashboard();

  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <span className="text-sm font-semibold text-muted-foreground">
        {FILTER_LABELS[filter]}
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold ${viewMode === "list" ? "text-foreground" : "text-muted-foreground"}`}
          >
            List
          </span>
          <Switch
            checked={viewMode === "board"}
            onCheckedChange={(checked) =>
              setViewMode(checked ? "board" : "list")
            }
          />
          <span
            className={`text-xs font-semibold ${viewMode === "board" ? "text-foreground" : "text-muted-foreground"}`}
          >
            Board
          </span>
        </div>
        {viewMode === "list" && (
          <div className="flex rounded-lg bg-muted p-0.5">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  filter === value
                    ? "bg-background font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
