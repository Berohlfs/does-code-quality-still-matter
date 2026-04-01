"use client";

import { Calendar, ChevronDown, ChevronRight, Pencil, Plus, Share2, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTodos } from "@/app/(private)/_hooks/use-todos";
import { getChildren, getAllDescendants, isOverdue } from "@/app/(private)/_helpers/todos";
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

function statusLabel(s: string) {
  return s === "in-progress"
    ? "In Progress"
    : s.charAt(0).toUpperCase() + s.slice(1);
}

interface TodoItemProps {
  todo: TodoDto;
  nested?: boolean;
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
  onShare?: (todo: TodoDto) => void;
}

export function TodoItem({ todo, nested, onEdit, onDelete, onAddSubtask, onShare }: TodoItemProps) {
  const { data: todos = [] } = useTodos();
  const { collapsed, toggleCollapse } = useDashboard();
  const children = getChildren(todos, todo.id);
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(todo.id);

  return (
    <li
      className={`group/item border-l-[3px] border bg-card transition-all hover:shadow-md ${STATUS_COLORS[todo.status]} ${
        nested ? "rounded-lg p-3" : "rounded-xl p-4"
      }`}
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
        onShare={onShare}
      />

      {hasChildren && !isCollapsed && (
        <SubtaskList
          parentId={todo.id}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
          onShare={onShare}
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
  onShare,
}: {
  parentId: number;
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
  onShare?: (todo: TodoDto) => void;
}) {
  const { data: todos = [] } = useTodos();
  const { filter } = useDashboard();

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
      {items.map((t) => (
        <TodoItem
          key={t.id}
          todo={t}
          nested
          onEdit={onEdit}
          onDelete={onDelete}
          onAddSubtask={onAddSubtask}
          onShare={onShare}
        />
      ))}
    </ul>
  );
}

export function TodoBody({
  todo,
  showStatus,
  onEdit,
  onDelete,
  onAddSubtask,
  onShare,
}: {
  todo: TodoDto;
  showStatus: boolean;
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
  onShare?: (todo: TodoDto) => void;
}) {
  const overdue = isOverdue(todo);
  const isShared = !!todo.share;
  const isViewer = todo.share?.role === "viewer";
  const canEdit = !isShared || todo.share?.role === "editor";
  const isOwner = !isShared;

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
          {isOwner && onShare && !todo.parentId && (
            <ActionButton title="Share" onClick={() => onShare(todo)}>
              <Share2 className="h-3.5 w-3.5" />
            </ActionButton>
          )}
          {canEdit && (
            <>
              <ActionButton title="Add subtask" onClick={() => onAddSubtask(todo.id)}>
                <Plus className="h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton title="Edit" onClick={() => onEdit(todo)}>
                <Pencil className="h-3.5 w-3.5" />
              </ActionButton>
            </>
          )}
          {isOwner && (
            <ActionButton title="Delete" onClick={() => onDelete(todo)}>
              <Trash2 className="h-3.5 w-3.5" />
            </ActionButton>
          )}
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
            {statusLabel(todo.status)}
          </Badge>
        )}
        {isShared && (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0 text-[0.6875rem] font-semibold tracking-wide bg-violet-500/10 text-violet-700 dark:text-violet-400"
          >
            <Users className="mr-1 h-3 w-3" />
            Shared by {todo.share!.ownerName}
            {isViewer ? " (view only)" : " (editor)"}
          </Badge>
        )}
        {todo.dueDate && (
          <span
            className={`flex items-center gap-1 text-xs font-medium ${
              overdue ? "font-semibold text-destructive" : "text-muted-foreground"
            }`}
          >
            <Calendar className="h-3 w-3" />
            {formatDate(todo.dueDate)}
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
