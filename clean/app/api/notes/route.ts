import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { notes } from "@/db/schemas";
import { getRequestUser } from "@/lib/request";
import { createNoteSchema } from "@/lib/schemas";

export async function GET() {
  const user = await getRequestUser();

  const rows = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, user.id))
    .orderBy(desc(notes.updatedAt));

  return NextResponse.json(
    rows.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content ?? "",
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }))
  );
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  const body = await request.json();
  const result = createNoteSchema.safeParse(body);

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

  return NextResponse.json(
    { id, title, content: content ?? "", createdAt: now, updatedAt: now },
    { status: 201 }
  );
}
