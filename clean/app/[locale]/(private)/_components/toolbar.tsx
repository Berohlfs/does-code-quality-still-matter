"use client";

import { useTranslations } from "next-intl";
import { useDashboard } from "./dashboard-context";
import { Switch } from "@/components/ui/switch";
import type { TodoStatus } from "../_validations/todo-status";

const FILTER_VALUES: Array<TodoStatus | "all"> = ["all", "pending", "in-progress", "done"];

const FILTER_LABEL_KEYS: Record<string, string> = {
  all: "all",
  pending: "pending",
  "in-progress": "inProgress",
  done: "done",
};

const FILTER_HEADING_KEYS: Record<string, string> = {
  all: "allTasks",
  pending: "pendingTasks",
  "in-progress": "inProgressTasks",
  done: "completedTasks",
};

export function Toolbar() {
  const t = useTranslations("dashboard");
  const { filter, setFilter, viewMode, setViewMode } = useDashboard();

  return (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <span className="text-sm font-semibold text-muted-foreground">
        {t(FILTER_HEADING_KEYS[filter])}
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold ${viewMode === "list" ? "text-foreground" : "text-muted-foreground"}`}
          >
            {t("list")}
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
            {t("board")}
          </span>
        </div>
        {viewMode === "list" && (
          <div className="flex rounded-lg bg-muted p-0.5">
            {FILTER_VALUES.map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  filter === value
                    ? "bg-background font-semibold text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(FILTER_LABEL_KEYS[value])}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
