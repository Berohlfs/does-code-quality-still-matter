"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useShares } from "@/app/(private)/_hooks/use-shares";
import { useCreateShare } from "@/app/(private)/_hooks/use-create-share";
import { useRevokeShare } from "@/app/(private)/_hooks/use-revoke-share";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createShareBodyDto, type CreateShareBody } from "@/dto/share";
import type { TodoDto } from "@/dto/todo";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: TodoDto | null;
}

export function ShareDialog({ open, onOpenChange, todo }: ShareDialogProps) {
  const { data: shares = [], isLoading } = useShares(
    open && todo ? todo.id : null
  );
  const createShare = useCreateShare();
  const revokeShare = useRevokeShare();

  const { control, handleSubmit, reset } = useForm<CreateShareBody>({
    resolver: zodResolver(createShareBodyDto),
    defaultValues: { email: "", role: "viewer" },
  });

  async function onSubmit(data: CreateShareBody) {
    if (!todo) return;
    try {
      await createShare.mutateAsync({ todoId: todo.id, data });
      toast.success(`Invite sent to ${data.email}`);
      reset({ email: "", role: "viewer" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send invite"
      );
    }
  }

  function handleRevoke(shareId: number) {
    if (!todo) return;
    revokeShare.mutate(
      { todoId: todo.id, shareId },
      {
        onSuccess: () => toast.success("Share revoked"),
        onError: () => toast.error("Failed to revoke share"),
      }
    );
  }

  if (!todo) return null;

  const activeShares = shares.filter((s) => s.status !== "revoked");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share: {todo.title}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
        >
          <Controller
            name="email"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid || undefined}>
                <FieldLabel htmlFor="share-email">Email address</FieldLabel>
                <Input
                  {...field}
                  id="share-email"
                  type="email"
                  placeholder="collaborator@example.com"
                  autoComplete="off"
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <Button type="submit" disabled={createShare.isPending}>
            {createShare.isPending ? "Sending..." : "Send Invite"}
          </Button>
        </form>

        {activeShares.length > 0 && (
          <div className="mt-2">
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              Collaborators
            </p>
            <ul className="flex flex-col gap-2">
              {activeShares.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="flex-1 truncate">{s.inviteeEmail}</span>
                  <Badge
                    variant="secondary"
                    className="rounded-full px-2 py-0 text-[0.625rem] font-semibold uppercase tracking-wide"
                  >
                    {s.role}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0 text-[0.625rem] font-semibold uppercase tracking-wide ${
                      s.status === "accepted"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {s.status}
                  </Badge>
                  <button
                    title="Revoke"
                    onClick={() => handleRevoke(s.id)}
                    disabled={revokeShare.isPending}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoading && (
          <p className="text-center text-xs text-muted-foreground">
            Loading shares...
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
