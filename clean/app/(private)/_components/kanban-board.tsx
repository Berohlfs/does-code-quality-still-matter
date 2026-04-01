"use client";

import { useTodos } from "@/app/(private)/_hooks/use-todos";
import { useUpdateTodo } from "@/app/(private)/_hooks/use-update-todo";
import { getRootTodos, getChildren } from "@/app/(private)/_helpers/todos";
import { TodoBody } from "./todo-item";
import type { TodoDto } from "@/dto/todo";
import type { TodoStatus } from "@/dto/todo";
import { toast } from "sonner";

const COLUMNS: Array<{ status: TodoStatus; label: string; dotClass: string }> = [
  { status: "pending", label: "Pending", dotClass: "bg-amber-500" },
  { status: "in-progress", label: "In Progress", dotClass: "bg-blue-500" },
  { status: "done", label: "Done", dotClass: "bg-emerald-500" },
];

interface KanbanBoardProps {
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
}

export function KanbanBoard({ onEdit, onDelete, onAddSubtask }: KanbanBoardProps) {
  const { data: todos = [] } = useTodos();
  const updateTodo = useUpdateTodo();
  const rootTodos = getRootTodos(todos);

  function handleDrop(todoId: number, newStatus: TodoStatus) {
    updateTodo.mutate(
      { id: todoId, data: { status: newStatus } },
      { onError: () => toast.error("Failed to update status") }
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 pb-20 sm:grid-cols-3">
      {COLUMNS.map(({ status, label, dotClass }) => {
        const items = rootTodos.filter((t) => t.status === status);

        return (
          <KanbanColumn
            key={status}
            status={status}
            label={label}
            dotClass={dotClass}
            count={items.length}
            items={items}
            allTodos={todos}
            onDrop={handleDrop}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddSubtask={onAddSubtask}
          />
        );
      })}
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  dotClass,
  count,
  items,
  allTodos,
  onDrop,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  status: TodoStatus;
  label: string;
  dotClass: string;
  count: number;
  items: TodoDto[];
  allTodos: TodoDto[];
  onDrop: (todoId: number, newStatus: TodoStatus) => void;
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
}) {
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("bg-primary/5", "outline-dashed", "outline-2", "outline-primary/30");
  }

  function handleDragLeave(e: React.DragEvent) {
    e.currentTarget.classList.remove("bg-primary/5", "outline-dashed", "outline-2", "outline-primary/30");
  }

  function handleDropEvent(e: React.DragEvent) {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-primary/5", "outline-dashed", "outline-2", "outline-primary/30");
    const todoId = Number(e.dataTransfer.getData("text/plain"));
    if (todoId) onDrop(todoId, status);
  }

  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <h3 className="flex-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </h3>
        <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {count}
        </span>
      </div>
      <div
        className="flex min-h-[40px] flex-col gap-2 rounded-lg transition-colors"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropEvent}
      >
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No items
          </p>
        ) : (
          items.map((todo) => (
            <KanbanCard
              key={todo.id}
              todo={todo}
              allTodos={allTodos}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubtask={onAddSubtask}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  todo,
  allTodos,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  todo: TodoDto;
  allTodos: TodoDto[];
  onEdit: (todo: TodoDto) => void;
  onDelete: (todo: TodoDto) => void;
  onAddSubtask: (parentId: number) => void;
}) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", String(todo.id));
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).classList.add("opacity-50", "rotate-1", "scale-[1.02]");
  }

  function handleDragEnd(e: React.DragEvent) {
    (e.currentTarget as HTMLElement).classList.remove("opacity-50", "rotate-1", "scale-[1.02]");
  }

  const children = getChildren(allTodos, todo.id);

  return (
    <div
      className="group/item cursor-grab rounded-xl border bg-card p-3.5 transition-all hover:shadow-md active:cursor-grabbing"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <TodoBody
        todo={todo}
        showStatus={false}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddSubtask={onAddSubtask}
      />

      {children.length > 0 && (
        <KanbanSubtasks parentId={todo.id} allTodos={allTodos} depth={0} />
      )}
    </div>
  );
}

const DOT_COLORS = {
  pending: "bg-amber-500",
  "in-progress": "bg-blue-500",
  done: "bg-emerald-500",
} as const;

function KanbanSubtasks({
  parentId,
  allTodos,
  depth,
}: {
  parentId: number;
  allTodos: TodoDto[];
  depth: number;
}) {
  const children = getChildren(allTodos, parentId);
  if (children.length === 0) return null;

  return (
    <div
      className={
        depth === 0
          ? "mt-2.5 border-t pt-2.5"
          : "mt-1 ml-1 border-l-2 border-border pl-2.5"
      }
    >
      {depth === 0 && (
        <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
          Subtasks ({children.length})
        </p>
      )}
      {children.map((c) => (
        <div key={c.id}>
          <div className="flex items-center gap-1.5 py-0.5 text-xs">
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLORS[c.status]}`}
            />
            <span
              className={`flex-1 truncate ${
                c.status === "done"
                  ? "line-through opacity-45"
                  : "text-muted-foreground"
              }`}
            >
              {c.title}
            </span>
          </div>
          <KanbanSubtasks parentId={c.id} allTodos={allTodos} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}
