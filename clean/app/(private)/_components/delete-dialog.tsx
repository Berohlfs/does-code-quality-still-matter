"use client";

import type { TodoDto } from "@/dto/todo";
import { useTodos } from "@/app/(private)/_hooks/use-todos";
import { useDeleteTodo } from "@/app/(private)/_hooks/use-delete-todo";
import { getChildren } from "@/app/(private)/_helpers/todos";
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
  todo: TodoDto | null;
}

export function DeleteDialog({ open, onOpenChange, todo }: DeleteDialogProps) {
  const { data: todos = [] } = useTodos();
  const deleteTodo = useDeleteTodo();

  if (!todo) return null;

  const children = getChildren(todos, todo.id);
  const hasChildren = children.length > 0;

  function handleDelete(cascade: boolean) {
    deleteTodo.mutate(
      { id: todo!.id, cascade },
      {
        onSuccess: () => {
          toast.success("Task deleted");
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to delete task"),
      }
    );
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
            disabled={deleteTodo.isPending}
            onClick={() => handleDelete(true)}
          >
            {hasChildren ? "Delete all" : "Delete"}
          </Button>
          {hasChildren && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={deleteTodo.isPending}
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
