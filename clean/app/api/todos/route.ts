import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { todos, attachments } from "@/db/schemas";
import { getRequestUser, validationError } from "@/app/api/_helpers/request";
import { createTodoBodyDto, type TodoDto } from "@/dto/todo";
import { toAttachmentDto } from "@/dto/attachment";
import { emailProvider } from "@/providers/email";

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

  const result: TodoDto[] = rows.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    title: t.title,
    description: t.description ?? "",
    status: (t.status ?? "pending") as TodoDto["status"],
    dueDate: t.dueDate,
    attachments: atts.filter((a) => a.todoId === t.id).map(toAttachmentDto),
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  const body = await request.json();
  const result = createTodoBodyDto.safeParse(body);

  if (!result.success) {
    return validationError(result.error);
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

  const todo: TodoDto = {
    id,
    parentId: parentId ?? null,
    title,
    description: description ?? "",
    status: status ?? "pending",
    dueDate: dueDate ?? null,
    attachments: [],
  };

  emailProvider.sendMail({
    to: user.email,
    subject: `New Todo: ${todo.title}`,
    text: [
      "A new todo item was added.",
      "",
      `Title: ${todo.title}`,
      `Description: ${todo.description || "(none)"}`,
      `Status: ${todo.status}`,
      `Due Date: ${todo.dueDate || "(none)"}`,
    ].join("\n"),
  });

  return NextResponse.json(todo, { status: 201 });
}
