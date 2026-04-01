"use client";

import { useState, useCallback } from "react";
import { useTodos } from "@/app/(private)/_hooks/use-todos";
import { DashboardProvider, useDashboard } from "./dashboard-context";
import { useRegisterNewTaskHandler } from "./new-task-context";
import { StatsBar } from "./stats-bar";
import { Toolbar } from "./toolbar";
import { TodoList } from "./todo-list";
import { KanbanBoard } from "./kanban-board";
import { TodoDialog } from "./todo-dialog";
import { DeleteDialog } from "./delete-dialog";
import { ShareDialog } from "./share-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { TodoDto } from "@/dto/todo";

export function Dashboard() {
  return (
    <DashboardProvider>
      <DashboardContent />
    </DashboardProvider>
  );
}

function DashboardContent() {
  const { isLoading } = useTodos();
  const { viewMode } = useDashboard();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTodo, setEditTodo] = useState<TodoDto | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTodo, setDeleteTodo] = useState<TodoDto | null>(null);

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareTodo, setShareTodo] = useState<TodoDto | null>(null);

  const handleNewTask = useCallback(() => {
    setEditTodo(null);
    setParentId(null);
    setDialogOpen(true);
  }, []);

  useRegisterNewTaskHandler(handleNewTask);

  const handleEdit = useCallback((todo: TodoDto) => {
    setEditTodo(todo);
    setParentId(null);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((todo: TodoDto) => {
    setDeleteTodo(todo);
    setDeleteDialogOpen(true);
  }, []);

  const handleAddSubtask = useCallback((pid: number) => {
    setEditTodo(null);
    setParentId(pid);
    setDialogOpen(true);
  }, []);

  const handleShare = useCallback((todo: TodoDto) => {
    setShareTodo(todo);
    setShareDialogOpen(true);
  }, []);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        <StatsBar />
        <Toolbar />

        {viewMode === "list" ? (
          <TodoList
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddSubtask={handleAddSubtask}
            onShare={handleShare}
          />
        ) : (
          <KanbanBoard
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddSubtask={handleAddSubtask}
            onShare={handleShare}
          />
        )}
      </main>

      <TodoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editTodo={editTodo}
        parentId={parentId}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        todo={deleteTodo}
      />

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        todo={shareTodo}
      />
    </>
  );
}
