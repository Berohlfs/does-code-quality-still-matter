"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { useTodos } from "@/hooks/use-todos";

const STATUS_STYLES = {
  total: "text-foreground",
  pending: "text-amber-500",
  "in-progress": "text-blue-500",
  done: "text-emerald-500",
} as const;

export function StatsBar() {
  const { todos } = useTodos();

  const stats = useMemo(() => {
    const total = todos.length;
    const pending = todos.filter((t) => t.status === "pending").length;
    const inProgress = todos.filter((t) => t.status === "in-progress").length;
    const done = todos.filter((t) => t.status === "done").length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, pending, inProgress, done, pct };
  }, [todos]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      <StatCard label="Total" value={stats.total} colorClass={STATUS_STYLES.total} />
      <StatCard label="Pending" value={stats.pending} colorClass={STATUS_STYLES.pending} />
      <StatCard label="In Progress" value={stats.inProgress} colorClass={STATUS_STYLES["in-progress"]} />
      <StatCard label="Completed" value={stats.done} colorClass={STATUS_STYLES.done}>
        <div className="mt-2.5 h-1 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
            style={{ width: `${stats.pct}%` }}
          />
        </div>
      </StatCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  colorClass,
  children,
}: {
  label: string;
  value: number;
  colorClass: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="px-4 py-3 transition-shadow hover:shadow-md sm:px-5 sm:py-4">
      <div className={`text-2xl font-extrabold tracking-tight ${colorClass}`}>
        {value}
      </div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </Card>
  );
}
