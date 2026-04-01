"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAcceptShare } from "@/app/(private)/_hooks/use-accept-share";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const acceptShare = useAcceptShare();
  const router = useRouter();

  async function handleAccept() {
    if (!token) return;
    try {
      await acceptShare.mutateAsync(token);
      toast.success("Invite accepted! The shared todo is now in your list.");
      router.push("/");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to accept invite"
      );
    }
  }

  if (!token) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No invite token provided.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-center gap-4 p-6">
      <h1 className="text-lg font-bold">Accept Shared Todo</h1>
      <p className="text-center text-sm text-muted-foreground">
        You have been invited to collaborate on a todo. Click below to accept
        the invite.
      </p>
      <Button
        onClick={handleAccept}
        disabled={acceptShare.isPending}
        className="w-full"
      >
        {acceptShare.isPending ? "Accepting..." : "Accept Invite"}
      </Button>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}>
        <AcceptInviteContent />
      </Suspense>
    </main>
  );
}
