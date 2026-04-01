"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAcceptShare } from "@/app/(private)/_hooks/use-shares";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const acceptShare = useAcceptShare();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (token && !attempted) {
      setAttempted(true);
      acceptShare.mutate(token);
    }
  }, [token, attempted, acceptShare]);

  return (
    <main className="mx-auto flex max-w-md items-center justify-center px-6 py-20">
      <Card className="w-full p-8 text-center">
        {!token ? (
          <>
            <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h1 className="text-lg font-bold">Invalid Invite</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              No invite token provided.
            </p>
          </>
        ) : acceptShare.isPending ? (
          <>
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <h1 className="text-lg font-bold">Accepting Invite...</h1>
          </>
        ) : acceptShare.isError ? (
          <>
            <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h1 className="text-lg font-bold">Invite Failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This invite may have expired or already been accepted.
            </p>
          </>
        ) : (
          <>
            <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
            <h1 className="text-lg font-bold">Invite Accepted!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The shared todo now appears in your dashboard.
            </p>
          </>
        )}

        <Button className="mt-6" onClick={() => router.push("/")}>
          Go to Dashboard
        </Button>
      </Card>
    </main>
  );
}
