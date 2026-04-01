"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createLocalizedTodoSchema } from "../_validations/create-todo-schema";
import type { TodoDto, CreateTodoBody } from "@/dto/todo";
import { useTodos } from "@/app/[locale]/(private)/_hooks/use-todos";
import { useCreateTodo } from "@/app/[locale]/(private)/_hooks/use-create-todo";
import { useUpdateTodo } from "@/app/[locale]/(private)/_hooks/use-update-todo";
import { useUploadAttachments } from "@/app/[locale]/(private)/_hooks/use-upload-attachments";
import { useDeleteAttachment } from "@/app/[locale]/(private)/_hooks/use-delete-attachment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { FileDropZone } from "./file-drop-zone";
import { toast } from "sonner";
import { X } from "lucide-react";
import { formatSize } from "@/utils/formatters";

interface TodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTodo?: TodoDto | null;
  parentId?: number | null;
}

export function TodoDialog({
  open,
  onOpenChange,
  editTodo,
  parentId,
}: TodoDialogProps) {
  const t = useTranslations();
  const { data: todos = [] } = useTodos();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const uploadAttachments = useUploadAttachments();
  const deleteAttachment = useDeleteAttachment();

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const isEditing = !!editTodo;
  const parentTodo = parentId ? todos.find((t) => t.id === parentId) : null;
  const saving =
    createTodo.isPending ||
    updateTodo.isPending ||
    uploadAttachments.isPending;

  const schema = useMemo(() => createLocalizedTodoSchema(t), [t]);

  const { control, handleSubmit, reset } = useForm<CreateTodoBody>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      dueDate: null,
      parentId: null,
    },
  });

  useEffect(() => {
    if (open) {
      if (editTodo) {
        reset({
          title: editTodo.title,
          description: editTodo.description,
          status: editTodo.status,
          dueDate: editTodo.dueDate,
          parentId: editTodo.parentId,
        });
      } else {
        reset({
          title: "",
          description: "",
          status: "pending",
          dueDate: null,
          parentId: parentId ?? null,
        });
      }
      setPendingFiles([]);
    }
  }, [open, editTodo, parentId, reset]);

  async function onSubmit(data: CreateTodoBody) {
    try {
      if (isEditing) {
        const updated = await updateTodo.mutateAsync({
          id: editTodo!.id,
          data: {
            title: data.title,
            description: data.description,
            status: data.status,
            dueDate: data.dueDate,
          },
        });

        if (pendingFiles.length > 0) {
          await uploadAttachments.mutateAsync({
            todoId: updated.id,
            files: pendingFiles,
          });
        }

        toast.success(t("todoDialog.taskUpdated"));
      } else {
        const created = await createTodo.mutateAsync(data);

        if (pendingFiles.length > 0) {
          await uploadAttachments.mutateAsync({
            todoId: created.id,
            files: pendingFiles,
          });
        }

        toast.success(t("todoDialog.taskCreated"));
      }

      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("todoDialog.taskSaveFailed"));
    }
  }

  function handleDeleteAttachment(attId: string) {
    if (!editTodo) return;
    deleteAttachment.mutate(
      { todoId: editTodo.id, attId },
      {
        onSuccess: () => toast.success(t("todoDialog.attachmentRemoved")),
        onError: () => toast.error(t("todoDialog.attachmentRemoveFailed")),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("todoDialog.editTask")
              : parentTodo
                ? t("todoDialog.newSubtask")
                : t("todoDialog.newTask")}
          </DialogTitle>
        </DialogHeader>

        {parentTodo && !isEditing && (
          <div className="rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
            {t("todoDialog.subtaskOf", { title: parentTodo.title })}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Controller
            name="title"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="todo-title">{t("todoDialog.titleLabel")}</FieldLabel>
                <Input
                  {...field}
                  id="todo-title"
                  placeholder={t("todoDialog.titlePlaceholder")}
                  autoComplete="off"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="todo-desc">{t("todoDialog.descriptionLabel")}</FieldLabel>
                <Textarea
                  {...field}
                  id="todo-desc"
                  placeholder={t("todoDialog.descriptionPlaceholder")}
                  value={field.value ?? ""}
                  className="min-h-[80px] resize-y"
                />
              </Field>
            )}
          />

          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel>{t("todoDialog.statusLabel")}</FieldLabel>
                <Select
                  value={field.value ?? "pending"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("dashboard.pending")}</SelectItem>
                    <SelectItem value="in-progress">{t("dashboard.inProgress")}</SelectItem>
                    <SelectItem value="done">{t("dashboard.done")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <Controller
            name="dueDate"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="todo-due">{t("todoDialog.dueDateLabel")}</FieldLabel>
                <Input
                  {...field}
                  id="todo-due"
                  type="date"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </Field>
            )}
          />

          {isEditing && editTodo!.attachments.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-muted-foreground">
                {t("todoDialog.currentAttachments")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {editTodo!.attachments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs"
                  >
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-w-[140px] truncate font-medium text-primary hover:underline"
                    >
                      {a.originalName}
                    </a>
                    <span className="text-muted-foreground">
                      ({formatSize(a.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(a.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Field>
            <FieldLabel>{t("todoDialog.attachmentsLabel")}</FieldLabel>
            <FileDropZone files={pendingFiles} onChange={setPendingFiles} />
          </Field>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
