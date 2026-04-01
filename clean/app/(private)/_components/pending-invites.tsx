"use client";

import { usePendingInvites } from "@/app/(private)/_hooks/use-pending-invites";
import { useAcceptInvite } from "@/app/(private)/_hooks/use-accept-invite";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail } from "lucide-react";

interface PendingInvitesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PendingInvites({ open, onOpenChange }: PendingInvitesProps) {
  const { data: invites = [] } = usePendingInvites();
  const acceptInvite = useAcceptInvite();

  function handleAccept(shareId: number) {
    acceptInvite.mutate(shareId, {
      onSuccess: () => toast.success("Invite accepted"),
      onError: () => toast.error("Failed to accept invite"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pending Invites</DialogTitle>
        </DialogHeader>

        {invites.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No pending invites
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {inv.todoTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    from {inv.ownerName}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="shrink-0 rounded-full px-2 py-0 text-[0.625rem] font-semibold uppercase tracking-wide"
                >
                  {inv.role}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAccept(inv.id)}
                  disabled={acceptInvite.isPending}
                >
                  Accept
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PendingInvitesBadge({
  onClick,
}: {
  onClick: () => void;
}) {
  const { data: invites = [] } = usePendingInvites();

  if (invites.length === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Pending invites"
    >
      <Mail className="h-5 w-5" />
      <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[0.625rem] font-bold text-primary-foreground">
        {invites.length}
      </span>
    </button>
  );
}
