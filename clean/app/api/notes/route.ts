import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schemas";
import { getRequestUser } from "@/app/api/_helpers/request";
import { createNoteBodyDto, type NoteDto } from "@/dto/note";

export async function GET() {
  const user = await getRequestUser();

  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, user.id))
    .orderBy(desc(notes.updatedAt));

  const result: NoteDto[] = rows.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content ?? "",
    createdAt: n.createdAt!,
    updatedAt: n.updatedAt!,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  const body = await request.json();
  const result = createNoteBodyDto.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const { title, content } = result.data;
  const id = Date.now();
  const now = new Date();

  await db.insert(notes).values({
    id,
    userId: user.id,
    title,
    content: content ?? "",
  });

  const response: NoteDto = {
    id,
    title,
    content: content ?? "",
    createdAt: now,
    updatedAt: now,
  };

  return NextResponse.json(response, { status: 201 });
}
