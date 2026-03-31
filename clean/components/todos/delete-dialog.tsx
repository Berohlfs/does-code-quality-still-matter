"use client";

import { useState } from "react";
import type { Todo } from "@/lib/types";
import { deleteTodo } from "@/lib/api";
import { useTodos, getChildren } from "@/hooks/use-todos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: Todo | null;
}

export function DeleteDialog({ open, onOpenChange, todo }: DeleteDialogProps) {
  const { todos, refresh } = useTodos();
  const [deleting, setDeleting] = useState(false);

  if (!todo) return null;

  const children = getChildren(todos, todo.id);
  const hasChildren = children.length > 0;

  async function handleDelete(cascade: boolean) {
    setDeleting(true);
    try {
      await deleteTodo(todo!.id, cascade);
      await refresh();
      toast.success("Task deleted");
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete task");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Task</DialogTitle>
          <DialogDescription>
            {hasChildren
              ? `"${todo.title}" has ${children.length} subtask${children.length > 1 ? "s" : ""}. How would you like to proceed?`
              : `Are you sure you want to delete "${todo.title}"?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            className="w-full"
            disabled={deleting}
            onClick={() => handleDelete(true)}
          >
            {hasChildren ? "Delete all" : "Delete"}
          </Button>
          {hasChildren && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={deleting}
              onClick={() => handleDelete(false)}
            >
              Keep subtasks
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
