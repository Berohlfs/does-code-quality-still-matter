import { NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { todos, attachments, todoShares, users } from "@/db/schemas";
import { getRequestUser, validationError } from "@/app/api/_helpers/request";
import { createTodoBodyDto, type TodoDto } from "@/dto/todo";
import { toAttachmentDto } from "@/dto/attachment";
import { emailProvider } from "@/providers/email";
import type { ShareRole } from "@/dto/share";

export async function GET() {
  const user = await getRequestUser();

  // Fetch own todos
  const ownRows = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, user.id))
    .orderBy(todos.createdAt);

  // Fetch accepted shares for current user
  const sharedRows = await db
    .select({
      todo: todos,
      ownerName: users.name,
      role: todoShares.role,
    })
    .from(todoShares)
    .innerJoin(todos, eq(todoShares.todoId, todos.id))
    .innerJoin(users, eq(todoShares.ownerUserId, users.id))
    .where(
      and(
        eq(todoShares.sharedWithUserId, user.id),
        eq(todoShares.status, "accepted")
      )
    );

  // Collect shared root todo IDs to also fetch their descendants
  const sharedRootIds = sharedRows.map((r) => r.todo.id);
  const sharedDescendants =
    sharedRootIds.length > 0
      ? await db
          .select()
          .from(todos)
          .where(inArray(todos.parentId, sharedRootIds))
      : [];

  // Build a lookup for sharing metadata keyed by root shared todo ID
  const sharingByRootId = new Map(
    sharedRows.map((r) => [
      r.todo.id,
      { ownerName: r.ownerName, role: r.role as ShareRole },
    ])
  );

  // Recursively collect all descendant IDs for shared todos
  async function getSharedDescendantIds(parentIds: number[]): Promise<number[]> {
    if (parentIds.length === 0) return [];
    const children = await db
      .select({ id: todos.id })
      .from(todos)
      .where(inArray(todos.parentId, parentIds));
    const childIds = children.map((c) => c.id);
    const deeper = await getSharedDescendantIds(childIds);
    return [...childIds, ...deeper];
  }

  const allSharedDescendantIds = await getSharedDescendantIds(sharedRootIds);
  const allSharedSubRows =
    allSharedDescendantIds.length > 0
      ? await db
          .select()
          .from(todos)
          .where(inArray(todos.id, allSharedDescendantIds))
      : [];

  // Merge all shared rows (roots + descendants)
  const allSharedTodos = [
    ...sharedRows.map((r) => r.todo),
    ...allSharedSubRows,
  ];

  // Map descendant to its root shared todo's sharing info
  function findSharingRoot(todoId: number, allTodos: typeof allSharedTodos): number | null {
    if (sharingByRootId.has(todoId)) return todoId;
    const todo = allTodos.find((t) => t.id === todoId);
    if (!todo?.parentId) return null;
    return findSharingRoot(todo.parentId, allTodos);
  }

  // Deduplicate: own todos take priority
  const ownIds = new Set(ownRows.map((t) => t.id));
  const uniqueSharedTodos = allSharedTodos.filter((t) => !ownIds.has(t.id));

  const allRows = [...ownRows, ...uniqueSharedTodos];
  const todoIds = allRows.map((t) => t.id);

  const atts =
    todoIds.length > 0
      ? await db
          .select()
          .from(attachments)
          .where(inArray(attachments.todoId, todoIds))
      : [];

  const result: TodoDto[] = allRows.map((t) => {
    const sharingRoot = ownIds.has(t.id) ? null : findSharingRoot(t.id, allSharedTodos);
    const sharing = sharingRoot ? sharingByRootId.get(sharingRoot) ?? null : null;

    return {
      id: t.id,
      parentId: t.parentId,
      title: t.title,
      description: t.description ?? "",
      status: (t.status ?? "pending") as TodoDto["status"],
      dueDate: t.dueDate,
      attachments: atts.filter((a) => a.todoId === t.id).map(toAttachmentDto),
      sharing: sharing ? { ownerName: sharing.ownerName, role: sharing.role } : null,
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
    sharing: null,
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
