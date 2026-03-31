import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { notes } from "@/db/schemas";
import { getRequestUser } from "@/lib/request";
import { updateNoteSchema } from "@/lib/schemas";

type Params = Promise<{ id: string }>;

export async function PUT(request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const { id: idStr } = await params;
  const id = Number(idStr);

  const body = await request.json();
  const result = updateNoteSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = rows[0];
  const updates = result.data;

  const title = updates.title ?? existing.title;
  const content = updates.content ?? existing.content ?? "";
  const now = new Date();

  await db
    .update(notes)
    .set({ title, content, updatedAt: now })
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)));

  return NextResponse.json({
    id,
    title,
    content,
    createdAt: existing.createdAt,
    updatedAt: now,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Params }
) {
  const user = await getRequestUser();
  const { id: idStr } = await params;
  const id = Number(idStr);

  const rows = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)));

  return new NextResponse(null, { status: 204 });
}
