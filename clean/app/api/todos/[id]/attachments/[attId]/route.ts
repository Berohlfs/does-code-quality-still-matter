import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db/client";
import { attachments } from "@/db/schemas";
import {
  getRequestUser,
  validationError,
  findUserTodo,
  notFound,
} from "@/app/api/_helpers/request";
import { attachmentParamsDto } from "@/dto/todo";

type Params = Promise<{ id: string; attId: string }>;

export async function DELETE(
  _request: Request,
  { params }: { params: Params }
) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = attachmentParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return validationError(paramsResult.error);
  }

  const todoId = Number(paramsResult.data.id);
  const { attId } = paramsResult.data;

  const todo = await findUserTodo(todoId, user.id);
  if (!todo) return notFound();

  const attRows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, attId), eq(attachments.todoId, todoId)))
    .limit(1);

  if (attRows.length === 0) {
    return notFound("Attachment not found");
  }

  try {
    await del(attRows[0].blobUrl);
  } catch {
    // Blob deletion is best-effort
  }

  await db.delete(attachments).where(eq(attachments.id, attId));

  return new NextResponse(null, { status: 204 });
}
