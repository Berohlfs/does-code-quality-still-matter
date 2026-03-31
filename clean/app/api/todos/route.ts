import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { todos, attachments } from "@/db/schemas";
import { getRequestUser } from "@/lib/request";
import { createTodoSchema } from "@/lib/schemas";
import { sendNewTodoEmail } from "@/lib/email";

export async function GET() {
  const user = await getRequestUser();

  const rows = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, user.id))
    .orderBy(todos.createdAt);

  const todoIds = rows.map((t) => t.id);

  const atts =
    todoIds.length > 0
      ? await db
          .select()
          .from(attachments)
          .where(inArray(attachments.todoId, todoIds))
      : [];

  const result = rows.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    dueDate: t.dueDate,
    attachments: atts
      .filter((a) => a.todoId === t.id)
      .map((a) => ({
        id: a.id,
        url: a.blobUrl,
        originalName: a.originalName,
        size: a.size,
      })),
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  const body = await request.json();
  const result = createTodoSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const { title, description, status, dueDate, parentId } = result.data;

  if (parentId) {
    const parent = await db
      .select({ id: todos.id })
      .from(todos)
      .where(eq(todos.id, parentId))
      .limit(1);

    if (parent.length === 0) {
      return NextResponse.json(
        { error: "Parent not found" },
        { status: 400 }
      );
    }
  }

  const id = Date.now();

  await db.insert(todos).values({
    id,
    userId: user.id,
    parentId: parentId ?? null,
    title,
    description: description ?? "",
    status: status ?? "pending",
    dueDate: dueDate ?? null,
  });

  const todo = {
    id,
    parentId: parentId ?? null,
    title,
    description: description ?? "",
    status: status ?? "pending",
    dueDate: dueDate ?? null,
    attachments: [],
  };

  sendNewTodoEmail(todo, user.email);

  return NextResponse.json(todo, { status: 201 });
}
