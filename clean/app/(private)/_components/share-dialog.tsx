"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createShareSchema,
  type CreateShareForm,
} from "../_validations/create-share-schema";
import { useShares, useCreateShare, useRevokeShare } from "../_hooks/use-shares";
import type { TodoDto } from "@/dto/todo";
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
import { Trash2, Clock, UserCheck } from "lucide-react";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: TodoDto | null;
}

export function ShareDialog({ open, onOpenChange, todo }: ShareDialogProps) {
  if (!todo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share &ldquo;{todo.title}&rdquo;</DialogTitle>
        </DialogHeader>
        <ShareForm todo={todo} />
      </DialogContent>
    </Dialog>
  );
}

function ShareForm({ todo }: { todo: TodoDto }) {
  const { data: shares = [], isLoading } = useShares(todo.id);
  const createShare = useCreateShare(todo.id);
  const revokeShare = useRevokeShare(todo.id);

  const { control, handleSubmit, reset } = useForm<CreateShareForm>({
    resolver: zodResolver(createShareSchema),
    defaultValues: { email: "", role: "viewer" },
  });

  async function onSubmit(data: CreateShareForm) {
    try {
      await createShare.mutateAsync(data);
      toast.success(`Invite sent to ${data.email}`);
      reset();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send invite";
      toast.error(message);
    }
  }

  function handleRevoke(shareId: number) {
    revokeShare.mutate(shareId, {
      onSuccess: () => toast.success("Invite revoked"),
      onError: () => toast.error("Failed to revoke invite"),
    });
  }

  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
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

      {shares.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">
            Shared with
          </p>
          <ul className="flex flex-col gap-2">
            {shares.map((share) => {
              const expired =
                share.status === "pending" &&
                new Date(share.expiresAt) < now;

              return (
                <li
                  key={share.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="flex-1 truncate">
                    {share.sharedWithEmail}
                  </span>
                  <Badge
                    variant="secondary"
                    className="rounded-full px-2 py-0 text-[0.6875rem] font-semibold uppercase"
                  >
                    {share.role}
                  </Badge>
                  {share.status === "accepted" ? (
                    <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
                  ) : expired ? (
                    <span className="text-xs text-destructive">Expired</span>
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleRevoke(share.id)}
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                    title="Revoke"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
