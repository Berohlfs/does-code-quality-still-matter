import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schemas";
import { getRequestUser } from "@/app/api/_helpers/request";
import { noteParamsDto, updateNoteBodyDto, type NoteDto } from "@/dto/note";

type Params = Promise<{ id: string }>;

export async function PUT(request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = noteParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return NextResponse.json(
      { error: paramsResult.error.issues[0].message },
      { status: 400 }
    );
  }
  const id = Number(paramsResult.data.id);

  const body = await request.json();
  const bodyResult = updateNoteBodyDto.safeParse(body);
  if (!bodyResult.success) {
    return NextResponse.json(
      { error: bodyResult.error.issues[0].message },
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
  const updates = bodyResult.data;

  const title = updates.title ?? existing.title;
  const content = updates.content ?? existing.content ?? "";
  const now = new Date();

  await db
    .update(notes)
    .set({ title, content, updatedAt: now })
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)));

  const response: NoteDto = {
    id,
    title,
    content,
    createdAt: existing.createdAt!,
    updatedAt: now,
  };

  return NextResponse.json(response);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Params }
) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = noteParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return NextResponse.json(
      { error: paramsResult.error.issues[0].message },
      { status: 400 }
    );
  }
  const id = Number(paramsResult.data.id);

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
