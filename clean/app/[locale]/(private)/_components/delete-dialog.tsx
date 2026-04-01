"use client";

import { useTranslations } from "next-intl";
import type { TodoDto } from "@/dto/todo";
import { useTodos } from "@/app/[locale]/(private)/_hooks/use-todos";
import { useDeleteTodo } from "@/app/[locale]/(private)/_hooks/use-delete-todo";
import { getChildren } from "@/app/[locale]/(private)/_helpers/todos";
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
  const t = useTranslations();
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
          toast.success(t("deleteDialog.taskDeleted"));
          onOpenChange(false);
        },
        onError: () => toast.error(t("deleteDialog.deleteFailed")),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("deleteDialog.deleteTask")}</DialogTitle>
          <DialogDescription>
            {hasChildren
              ? t("deleteDialog.hasSubtasks", { title: todo.title, count: children.length })
              : t("deleteDialog.confirmDelete", { title: todo.title })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="destructive"
            className="w-full"
            disabled={deleteTodo.isPending}
            onClick={() => handleDelete(true)}
          >
            {hasChildren ? t("deleteDialog.deleteAll") : t("common.delete")}
          </Button>
          {hasChildren && (
            <Button
              variant="secondary"
              className="w-full"
              disabled={deleteTodo.isPending}
              onClick={() => handleDelete(false)}
            >
              {t("deleteDialog.keepSubtasks")}
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
