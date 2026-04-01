import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { todos, todoShares } from "@/db/schemas";
import {
  getRequestUser,
  validationError,
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
  if (!paramsResult.success) {
    return validationError(paramsResult.error);
  }

  const todoId = Number(paramsResult.data.id);
  const shareId = Number(paramsResult.data.shareId);

  const todo = await db
    .select({ id: todos.id })
    .from(todos)
    .where(and(eq(todos.id, todoId), eq(todos.userId, user.id)))
    .limit(1);

  if (todo.length === 0) return notFound();

  const share = await db
    .select()
    .from(todoShares)
    .where(and(eq(todoShares.id, shareId), eq(todoShares.todoId, todoId)))
    .limit(1);

  if (share.length === 0) return notFound("Share not found");

  if (share[0].status === "revoked") {
    return NextResponse.json(
      { error: "Share already revoked" },
      { status: 400 }
    );
  }

  await db
    .update(todoShares)
    .set({ status: "revoked" })
    .where(eq(todoShares.id, shareId));

  return new NextResponse(null, { status: 204 });
}
