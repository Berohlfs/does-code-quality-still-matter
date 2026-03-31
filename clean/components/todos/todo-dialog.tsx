"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createTodoSchema } from "@/lib/schemas";
import type { CreateTodoInput } from "@/lib/schemas";
import type { Todo } from "@/lib/types";
import { createTodo, updateTodo, uploadAttachments, deleteAttachment } from "@/lib/api";
import { useTodos, formatSize } from "@/hooks/use-todos";
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
import {
  Field,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { FileDropZone } from "./file-drop-zone";
import { toast } from "sonner";
import { X } from "lucide-react";

interface TodoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTodo?: Todo | null;
  parentId?: number | null;
}

export function TodoDialog({
  open,
  onOpenChange,
  editTodo,
  parentId,
}: TodoDialogProps) {
  const { todos, refresh } = useTodos();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const isEditing = !!editTodo;
  const parentTodo = parentId
    ? todos.find((t) => t.id === parentId)
    : null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { isValid },
  } = useForm<CreateTodoInput>({
    resolver: zodResolver(createTodoSchema),
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

  async function onSubmit(data: CreateTodoInput) {
    setSaving(true);
    try {
      if (isEditing) {
        const updated = await updateTodo(editTodo!.id, {
          title: data.title,
          description: data.description,
          status: data.status,
          dueDate: data.dueDate,
        });

        if (pendingFiles.length > 0) {
          await uploadAttachments(updated.id, pendingFiles);
        }

        toast.success("Task updated");
      } else {
        const created = await createTodo(data);

        if (pendingFiles.length > 0) {
          await uploadAttachments(created.id, pendingFiles);
        }

        toast.success("Task created");
      }

      await refresh();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAttachment(attId: string) {
    if (!editTodo) return;
    try {
      await deleteAttachment(editTodo.id, attId);
      await refresh();
      toast.success("Attachment removed");
    } catch {
      toast.error("Failed to remove attachment");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Task" : parentTodo ? "New Subtask" : "New Task"}
          </DialogTitle>
        </DialogHeader>

        {parentTodo && !isEditing && (
          <div className="rounded-lg bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
            Subtask of: {parentTodo.title}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Controller
            name="title"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="todo-title">Title *</FieldLabel>
                <Input
                  {...field}
                  id="todo-title"
                  placeholder="What needs to be done?"
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
                <FieldLabel htmlFor="todo-desc">Description</FieldLabel>
                <Textarea
                  {...field}
                  id="todo-desc"
                  placeholder="Add some details..."
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
                <FieldLabel>Status</FieldLabel>
                <Select
                  value={field.value ?? "pending"}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
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
                <FieldLabel htmlFor="todo-due">Due Date</FieldLabel>
                <Input
                  {...field}
                  id="todo-due"
                  type="date"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(e.target.value || null)
                  }
                />
              </Field>
            )}
          />

          {isEditing && editTodo!.attachments.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-muted-foreground">
                Current Attachments
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
            <FieldLabel>Attachments</FieldLabel>
            <FileDropZone files={pendingFiles} onChange={setPendingFiles} />
          </Field>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
