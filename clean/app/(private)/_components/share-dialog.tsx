"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import { X, UserPlus } from "lucide-react";
import type { ShareRole } from "@/dto/share";
import type { TodoDto } from "@/dto/todo";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo: TodoDto | null;
}

export function ShareDialog({ open, onOpenChange, todo }: ShareDialogProps) {
  const { data: shares = [], isLoading } = useShares(todo?.id ?? null);
  const createShare = useCreateShare();
  const revokeShare = useRevokeShare();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("viewer");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!todo || !email.trim()) return;

    try {
      await createShare.mutateAsync({
        todoId: todo.id,
        data: { email: email.trim(), role },
      });
      toast.success("Invite sent");
      setEmail("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to send invite";
      const axiosMessage = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(axiosMessage || message);
    }
  }

  function handleRevoke(shareId: number) {
    if (!todo) return;
    revokeShare.mutate(
      { todoId: todo.id, shareId },
      {
        onSuccess: () => toast.success("Invite revoked"),
        onError: () => toast.error("Failed to revoke invite"),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share: {todo?.title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleInvite} className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="share-email">Invite by email</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="share-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
                autoComplete="off"
              />
              <Select
                value={role}
                onValueChange={(v) => setRole(v as ShareRole)}
              >
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Button
            type="submit"
            size="sm"
            disabled={createShare.isPending || !email.trim()}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            {createShare.isPending ? "Sending..." : "Send Invite"}
          </Button>
        </form>

        {!isLoading && shares.length > 0 && (
          <div className="mt-2">
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              Current shares
            </p>
            <ul className="flex flex-col gap-1.5">
              {shares.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{s.sharedUserName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.sharedUserEmail}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="shrink-0 rounded-full px-2 py-0 text-[0.625rem] font-semibold uppercase tracking-wide"
                  >
                    {s.role}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`shrink-0 rounded-full px-2 py-0 text-[0.625rem] font-semibold uppercase tracking-wide ${
                      s.status === "pending"
                        ? "border-amber-500/30 text-amber-600"
                        : "border-emerald-500/30 text-emerald-600"
                    }`}
                  >
                    {s.status}
                  </Badge>
                  {s.status === "pending" && (
                    <button
                      onClick={() => handleRevoke(s.id)}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive"
                      title="Revoke invite"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
