import { NextResponse } from "next/server";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { todos, attachments, shares, users } from "@/db/schemas";
import { getRequestUser, validationError } from "@/app/api/_helpers/request";
import { createTodoBodyDto, type TodoDto } from "@/dto/todo";
import { toAttachmentDto } from "@/dto/attachment";
import { emailProvider } from "@/providers/email";

export async function GET() {
  const user = await getRequestUser();

  const ownedRows = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, user.id))
    .orderBy(todos.createdAt);

  const acceptedShares = await db
    .select({
      todoId: shares.todoId,
      role: shares.role,
      ownerName: users.name,
    })
    .from(shares)
    .innerJoin(users, eq(users.id, shares.ownerUserId))
    .where(
      and(eq(shares.sharedUserId, user.id), eq(shares.status, "accepted"))
    );

  const sharedRootIds = acceptedShares.map((s) => s.todoId);

  let sharedRows: (typeof ownedRows) = [];
  if (sharedRootIds.length > 0) {
    sharedRows = await db.execute<(typeof ownedRows)[0]>(sql`
      WITH RECURSIVE tree AS (
        SELECT * FROM todos WHERE id IN ${sql`(${sql.join(sharedRootIds.map((id) => sql`${id}`), sql`, `)})`}
        UNION ALL
        SELECT t.* FROM todos t INNER JOIN tree tr ON t.parent_id = tr.id
      )
      SELECT * FROM tree ORDER BY created_at
    `);
  }

  const shareByRootId = new Map(
    acceptedShares.map((s) => [s.todoId, { role: s.role as TodoDto["share"] extends { role: infer R } ? R : never, ownerName: s.ownerName }])
  );

  function getShareInfoForTodo(todo: { id: number; parentId: number | null }): TodoDto["share"] {
    if (shareByRootId.has(todo.id)) return shareByRootId.get(todo.id)!;
    if (todo.parentId) {
      const parent = sharedRows.find((r) => r.id === todo.parentId);
      if (parent) return getShareInfoForTodo(parent);
    }
    return undefined;
  }

  const allRows = [...ownedRows, ...sharedRows];
  const todoIds = allRows.map((t) => t.id);

  const atts =
    todoIds.length > 0
      ? await db
          .select()
          .from(attachments)
          .where(inArray(attachments.todoId, todoIds))
      : [];

  const result: TodoDto[] = allRows.map((t) => {
    const isShared = sharedRows.some((s) => s.id === t.id);
    return {
      id: t.id,
      parentId: t.parentId,
      title: t.title,
      description: t.description ?? "",
      status: (t.status ?? "pending") as TodoDto["status"],
      dueDate: t.dueDate,
      attachments: atts.filter((a) => a.todoId === t.id).map(toAttachmentDto),
      ...(isShared ? { share: getShareInfoForTodo(t) } : {}),
    };
  });

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
