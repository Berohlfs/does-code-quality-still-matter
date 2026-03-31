"use client";

import { useState, useCallback } from "react";
import { useTodos } from "@/hooks/use-todos";
import { AppHeader } from "./app-header";
import { StatsBar } from "./stats-bar";
import { Toolbar } from "./toolbar";
import { TodoList } from "./todo-list";
import { KanbanBoard } from "./kanban-board";
import { TodoDialog } from "./todo-dialog";
import { DeleteDialog } from "./delete-dialog";
import type { Todo } from "@/lib/types";

export function Dashboard() {
  const { viewMode } = useTodos();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTodo, setDeleteTodo] = useState<Todo | null>(null);

  const handleNewTask = useCallback(() => {
    setEditTodo(null);
    setParentId(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((todo: Todo) => {
    setEditTodo(todo);
    setParentId(null);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((todo: Todo) => {
    setDeleteTodo(todo);
    setDeleteDialogOpen(true);
  }, []);

  const handleAddSubtask = useCallback((pid: number) => {
    setEditTodo(null);
    setParentId(pid);
    setDialogOpen(true);
  }, []);

  return (
    <>
      <AppHeader onNewTask={handleNewTask} />

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        <StatsBar />
        <Toolbar />

        {viewMode === "list" ? (
          <TodoList
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddSubtask={handleAddSubtask}
          />
        ) : (
          <KanbanBoard
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAddSubtask={handleAddSubtask}
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
    </>
  );
}
