"use client";

import { useTranslations, useLocale } from "next-intl";
import { Calendar, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTodos } from "@/app/[locale]/(private)/_hooks/use-todos";
import { getChildren, getAllDescendants, isOverdue } from "@/app/[locale]/(private)/_helpers/todos";
import { useDashboard } from "./dashboard-context";
import type { TodoDto } from "@/dto/todo";
import { formatDate, formatSize } from "@/utils/formatters";

const STATUS_COLORS = {
  pending: "border-l-amber-500",
  "in-progress": "border-l-blue-500",
  done: "border-l-emerald-500",
} as const;

const BADGE_VARIANTS = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "in-progress": "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
} as const;

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: "dashboard.pending",
  "in-progress": "dashboard.inProgress",
  done: "dashboard.done",
};

interface TodoItemProps {
  todo: TodoDto;
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
}

export function TodoItem({ todo, onEdit, onDelete, onAddSubtask }: TodoItemProps) {
  const { data: todos = [] } = useTodos();
  const { collapsed, toggleCollapse } = useDashboard();
  const children = getChildren(todos, todo.id);
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(todo.id);

  return (
    <li
      className={`group/item rounded-xl border-l-[3px] border bg-card p-4 transition-all hover:shadow-md ${STATUS_COLORS[todo.status]}`}
    >
      {hasChildren && (
        <button
          onClick={() => toggleCollapse(todo.id)}
          className="mb-1 flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/5"
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          <span className="text-muted-foreground">{children.length}</span>
        </button>
      )}

      <TodoBody
        todo={todo}
        showStatus
        onEdit={onEdit}
        onDelete={onDelete}
        onAddSubtask={onAddSubtask}
      />

      {hasChildren && !isCollapsed && (
        <SubtaskList
          parentId={todo.id}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
        />
      )}
    </li>
  );
}

function SubtaskList({
  parentId,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  parentId: number;
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
}) {
  const { data: todos = [] } = useTodos();
  const { filter, collapsed, toggleCollapse } = useDashboard();

  let items = getChildren(todos, parentId);
  if (filter !== "all") {
    items = items.filter(
      (t) =>
        t.status === filter ||
        getAllDescendants(todos, t.id).some((d) => d.status === filter)
    );
  }

  if (items.length === 0) return null;

  return (
    <ul className="mt-2.5 ml-2 flex flex-col gap-1.5 border-l-2 border-border pl-4">
      {items.map((t) => {
        const children = getChildren(todos, t.id);
        const hasChildren = children.length > 0;
        const isCollapsed = collapsed.has(t.id);

        return (
          <li
            key={t.id}
            className={`group/item rounded-lg border-l-[3px] border bg-card p-3 transition-all hover:shadow-md ${STATUS_COLORS[t.status]}`}
          >
            {hasChildren && (
              <button
                onClick={() => toggleCollapse(t.id)}
                className="mb-1 flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/5"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                <span className="text-muted-foreground">{children.length}</span>
              </button>
            )}

            <TodoBody
              todo={t}
              showStatus
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
            />

            {hasChildren && !isCollapsed && (
              <SubtaskList
                parentId={t.id}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddSubtask={onAddSubtask}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function TodoBody({
  todo,
  showStatus,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  todo: TodoDto;
  showStatus: boolean;
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const overdue = isOverdue(todo);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span
          className={`flex-1 text-sm font-semibold leading-snug ${
            todo.status === "done" ? "line-through opacity-45" : ""
          }`}
        >
          {todo.title}
        </span>
        <span className="flex gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100">
          <ActionButton title={t("todoItem.addSubtask")} onClick={() => onAddSubtask(todo.id)}>
            <Plus className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton title={t("todoItem.edit")} onClick={() => onEdit(todo)}>
            <Pencil className="h-3.5 w-3.5" />
          </ActionButton>
          <ActionButton title={t("todoItem.delete")} onClick={() => onDelete(todo)}>
            <Trash2 className="h-3.5 w-3.5" />
          </ActionButton>
        </span>
      </div>

      {todo.description && (
        <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {todo.description}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {showStatus && (
          <Badge
            variant="secondary"
            className={`rounded-full px-2.5 py-0 text-[0.6875rem] font-semibold uppercase tracking-wide ${BADGE_VARIANTS[todo.status]}`}
          >
            {t(STATUS_LABEL_KEYS[todo.status])}
          </Badge>
        )}
        {todo.dueDate && (
          <span
            className={`flex items-center gap-1 text-xs font-medium ${
              overdue ? "font-semibold text-destructive" : "text-muted-foreground"
            }`}
          >
            <Calendar className="h-3 w-3" />
            {formatDate(todo.dueDate, locale)}
          </span>
        )}
      </div>

      {todo.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {todo.attachments.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-primary hover:underline"
              title={`${a.originalName} (${formatSize(a.size)})`}
            >
              <span className="max-w-[140px] truncate">{a.originalName}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
