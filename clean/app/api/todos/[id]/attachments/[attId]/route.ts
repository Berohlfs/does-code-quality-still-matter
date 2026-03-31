import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db";
import { todos, attachments } from "@/db/schemas";
import { getRequestUser } from "@/lib/request";

type Params = Promise<{ id: string; attId: string }>;

export async function DELETE(
  _request: Request,
  { params }: { params: Params }
) {
  const user = await getRequestUser();
  const { id: idStr, attId } = await params;
  const todoId = Number(idStr);

  const todoRows = await db
    .select({ id: todos.id })
    .from(todos)
    .where(and(eq(todos.id, todoId), eq(todos.userId, user.id)))
    .limit(1);

  if (todoRows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attRows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, attId), eq(attachments.todoId, todoId)))
    .limit(1);

  if (attRows.length === 0) {
    return NextResponse.json(
      { error: "Attachment not found" },
      { status: 404 }
    );
  }

  try {
    await del(attRows[0].blobUrl);
  } catch {
    // Blob deletion is best-effort
  }

  await db.delete(attachments).where(eq(attachments.id, attId));

  return new NextResponse(null, { status: 204 });
}
