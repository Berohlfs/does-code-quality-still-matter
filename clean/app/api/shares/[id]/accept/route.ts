import { NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { shares } from "@/db/schemas";
import { getRequestUser, validationError, notFound } from "@/app/api/_helpers/request";
import { todoParamsDto } from "@/dto/todo";

type Params = Promise<{ id: string }>;

export async function POST(
  _request: Request,
  { params }: { params: Params }
) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) return validationError(paramsResult.error);

  const shareId = Number(paramsResult.data.id);

  const existing = await db
    .select()
    .from(shares)
    .where(
      and(
        eq(shares.id, shareId),
        eq(shares.sharedUserId, user.id),
        eq(shares.status, "pending"),
        gt(shares.expiresAt, new Date())
      )
    )
    .limit(1);

  if (existing.length === 0) {
    return notFound("Invite not found or expired");
  }

  await db
    .update(shares)
    .set({ status: "accepted" })
    .where(eq(shares.id, shareId));

  return NextResponse.json({ success: true });
}
