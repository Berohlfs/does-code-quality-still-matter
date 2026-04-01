import { NextResponse } from "next/server";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { todos, attachments, todoShares, users } from "@/db/schemas";
import { getRequestUser, validationError } from "@/app/api/_helpers/request";
import { createTodoBodyDto, type TodoDto } from "@/dto/todo";
import { toAttachmentDto } from "@/dto/attachment";
import { emailProvider } from "@/providers/email";

export async function GET() {
  const user = await getRequestUser();

  // Fetch user's own todos
  const ownRows = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, user.id))
    .orderBy(todos.createdAt);

  // Fetch accepted shares for this user
  const acceptedShares = await db
    .select({
      todoId: todoShares.todoId,
      role: todoShares.role,
      ownerUserId: todoShares.ownerUserId,
    })
    .from(todoShares)
    .where(
      and(
        eq(todoShares.inviteeEmail, user.email),
        eq(todoShares.status, "accepted")
      )
    );

  // Build a map of shared root todo IDs to share info
  const shareMap = new Map<number, { role: string; ownerUserId: number }>();
  for (const s of acceptedShares) {
    shareMap.set(s.todoId, { role: s.role, ownerUserId: s.ownerUserId });
  }

  // Fetch shared root todos + all their descendants via recursive CTE
  let sharedRows: (typeof ownRows) = [];
  if (shareMap.size > 0) {
    const sharedRootIds = [...shareMap.keys()];
    sharedRows = await db.execute<(typeof ownRows)[0]>(sql`
      WITH RECURSIVE tree AS (
        SELECT * FROM todos WHERE id IN (${sql.join(sharedRootIds.map((id) => sql`${id}`), sql`, `)})
        UNION ALL
        SELECT t.* FROM todos t INNER JOIN tree tr ON t.parent_id = tr.id
      )
      SELECT * FROM tree ORDER BY created_at
    `);
  }

  // For shared todos, find which root they belong to
  function findSharedRoot(todoId: number, parentId: number | null): number | null {
    if (shareMap.has(todoId)) return todoId;
    if (!parentId) return null;
    const parent = sharedRows.find((t) => t.id === parentId);
    if (!parent) return null;
    return findSharedRoot(parent.id, parent.parentId);
  }

  // Collect owner user IDs to fetch names
  const ownerIds = [...new Set([...shareMap.values()].map((s) => s.ownerUserId))];
  const ownerNameMap = new Map<number, string>();
  if (ownerIds.length > 0) {
    const ownerRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, ownerIds));
    for (const o of ownerRows) {
      ownerNameMap.set(o.id, o.name);
    }
  }

  const allRows = [...ownRows, ...sharedRows];
  const todoIds = allRows.map((t) => t.id);

  const atts =
    todoIds.length > 0
      ? await db
          .select()
          .from(attachments)
          .where(inArray(attachments.todoId, todoIds))
      : [];

  const result: TodoDto[] = allRows.map((t) => {
    const sharedRoot = sharedRows.includes(t) ? findSharedRoot(t.id, t.parentId) ?? t.id : null;
    const shareInfo = sharedRoot ? shareMap.get(sharedRoot) : null;

    return {
      id: t.id,
      parentId: t.parentId,
      title: t.title,
      description: t.description ?? "",
      status: (t.status ?? "pending") as TodoDto["status"],
      dueDate: t.dueDate,
      attachments: atts.filter((a) => a.todoId === t.id).map(toAttachmentDto),
      share: shareInfo
        ? {
            ownerName: ownerNameMap.get(shareInfo.ownerUserId) ?? "Unknown",
            role: shareInfo.role as "viewer" | "editor",
          }
        : null,
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
    share: null,
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
