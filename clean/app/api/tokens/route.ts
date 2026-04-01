import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { apiTokens } from "@/db/schemas";
import { getRequestUser } from "@/app/api/_helpers/request";
import { createApiTokenDto } from "@/dto/api-token";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function GET() {
  const user = await getRequestUser();

  const rows = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, user.id))
    .orderBy(apiTokens.createdAt);

  const tokens = rows.map((t) => ({
    id: t.id,
    name: t.name,
    prefix: t.prefix,
    createdAt: t.createdAt?.toISOString() ?? new Date().toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  }));

  return NextResponse.json(tokens);
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  const body = await request.json();
  const result = createApiTokenDto.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const rawToken = `tf_${randomBytes(32).toString("hex")}`;
  const tokenHash = hashToken(rawToken);
  const prefix = rawToken.slice(0, 11);
  const id = Date.now();

  await db.insert(apiTokens).values({
    id,
    userId: user.id,
    name: result.data.name,
    tokenHash,
    prefix,
  });

  return NextResponse.json(
    {
      token: rawToken,
      apiToken: {
        id,
        name: result.data.name,
        prefix,
        createdAt: new Date().toISOString(),
        lastUsedAt: null,
      },
    },
    { status: 201 }
  );
}
