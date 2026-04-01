"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Plus, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
} from "@/app/(private)/_hooks/use-api-tokens";

export function ApiTokensSection() {
  const { data: tokens, isLoading } = useApiTokens();
  const createMutation = useCreateApiToken();
  const revokeMutation = useRevokeApiToken();
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const result = await createMutation.mutateAsync(name.trim());
    setNewToken(result.token);
    setName("");
    toast.success("API token created");
  }

  function handleCopy(token: string) {
    navigator.clipboard.writeText(token);
    toast.success("Token copied to clipboard");
  }

  function handleRevoke(id: number) {
    revokeMutation.mutate(id, {
      onSuccess: () => toast.success("Token revoked"),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Tokens
        </CardTitle>
        <CardDescription>
          Generate tokens to access the Taskflow API from external applications.
          Use the token as a Bearer token in the Authorization header.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleCreate} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="token-name" className="sr-only">
              Token name
            </Label>
            <Input
              id="token-name"
              placeholder="Token name (e.g. CI/CD, Mobile App)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
            <Plus className="mr-1 h-4 w-4" />
            Generate
          </Button>
        </form>

        {newToken && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <p className="mb-2 text-sm font-medium text-green-700 dark:text-green-400">
              Your new API token (copy it now — it won&apos;t be shown again):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-sm font-mono">
                {newToken}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(newToken)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading tokens...</p>
          )}

          {tokens?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No API tokens yet. Generate one to get started.
            </p>
          )}

          {tokens?.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div className="space-y-1">
                <div className="font-medium">{token.name}</div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>
                    <code>{token.prefix}...</code>
                  </span>
                  <span>
                    Created{" "}
                    {new Date(token.createdAt).toLocaleDateString()}
                  </span>
                  {token.lastUsedAt && (
                    <span>
                      Last used{" "}
                      {new Date(token.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRevoke(token.id)}
                disabled={revokeMutation.isPending}
                title="Revoke token"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-muted p-4">
          <p className="mb-2 text-sm font-medium">Usage example:</p>
          <pre className="overflow-x-auto text-xs text-muted-foreground">
{`curl -H "Authorization: Bearer tf_your_token_here" \\
  ${typeof window !== "undefined" ? window.location.origin : "https://your-app.com"}/api/todos`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
