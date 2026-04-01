import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { shares } from "@/db/schemas";
import {
  getRequestUser,
  validationError,
  findUserTodo,
  notFound,
} from "@/app/api/_helpers/request";
import { shareParamsDto } from "@/dto/share";

type Params = Promise<{ id: string; shareId: string }>;

export async function DELETE(
  _request: Request,
  { params }: { params: Params }
) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = shareParamsDto.safeParse(rawParams);
  if (!paramsResult.success) return validationError(paramsResult.error);

  const todoId = Number(paramsResult.data.id);
  const shareId = Number(paramsResult.data.shareId);

  const todo = await findUserTodo(todoId, user.id);
  if (!todo) return notFound();

  const existing = await db
    .select({ id: shares.id, status: shares.status })
    .from(shares)
    .where(
      and(
        eq(shares.id, shareId),
        eq(shares.todoId, todoId),
        eq(shares.ownerUserId, user.id)
      )
    )
    .limit(1);

  if (existing.length === 0) return notFound("Share not found");

  if (existing[0].status !== "pending") {
    return NextResponse.json(
      { error: "Only pending invites can be revoked" },
      { status: 400 }
    );
  }

  await db.delete(shares).where(eq(shares.id, shareId));

  return new NextResponse(null, { status: 204 });
}
