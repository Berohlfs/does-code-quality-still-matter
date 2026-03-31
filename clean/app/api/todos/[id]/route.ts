import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db/client";
import { todos, attachments } from "@/db/schemas";
import { getRequestUser } from "@/app/api/_helpers/request";
import {
  todoParamsDto,
  updateTodoBodyDto,
  deleteTodoQueryDto,
  type TodoDto,
} from "@/dto/todo";

type Params = Promise<{ id: string }>;

export async function PUT(request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return NextResponse.json(
      { error: paramsResult.error.issues[0].message },
      { status: 400 }
    );
  }
  const id = Number(paramsResult.data.id);

  const body = await request.json();
  const bodyResult = updateTodoBodyDto.safeParse(body);
  if (!bodyResult.success) {
    return NextResponse.json(
      { error: bodyResult.error.issues[0].message },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = rows[0];
  const updates = bodyResult.data;

  const title = updates.title ?? existing.title;
  const description = updates.description ?? existing.description ?? "";
  const status = updates.status ?? existing.status;
  const dueDate =
    updates.dueDate !== undefined ? updates.dueDate : existing.dueDate;

  await db
    .update(todos)
    .set({ title, description, status, dueDate })
    .where(and(eq(todos.id, id), eq(todos.userId, user.id)));

  const atts = await db
    .select()
    .from(attachments)
    .where(eq(attachments.todoId, id));

  const response: TodoDto = {
    id,
    parentId: existing.parentId,
    title,
    description,
    status: status as TodoDto["status"],
    dueDate,
    attachments: atts.map((a) => ({
      id: a.id,
      url: a.blobUrl,
      originalName: a.originalName,
      size: a.size,
    })),
  };

  return NextResponse.json(response);
}

export async function DELETE(
  request: Request,
  { params }: { params: Params }
) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return NextResponse.json(
      { error: paramsResult.error.issues[0].message },
      { status: 400 }
    );
  }
  const id = Number(paramsResult.data.id);

  const url = new URL(request.url);
  const queryResult = deleteTodoQueryDto.safeParse({
    cascade: url.searchParams.get("cascade") ?? undefined,
  });
  const cascade = queryResult.success
    ? queryResult.data.cascade !== "false"
    : true;

  const rows = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, id), eq(todos.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const todo = rows[0];

  if (cascade) {
    const descendantAtts = await db.execute<{ blob_url: string }>(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id} AND user_id = ${user.id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
      SELECT blob_url FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
    `);

    for (const a of descendantAtts) {
      try {
        await del(a.blob_url);
      } catch {
        // Blob deletion is best-effort
      }
    }

    await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id} AND user_id = ${user.id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
      DELETE FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
    `);

    await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id} AND user_id = ${user.id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
      DELETE FROM todos WHERE id IN (SELECT id FROM descendants)
    `);
  } else {
    await db
      .update(todos)
      .set({ parentId: todo.parentId })
      .where(and(eq(todos.parentId, id), eq(todos.userId, user.id)));

    const atts = await db
      .select({ blobUrl: attachments.blobUrl })
      .from(attachments)
      .where(eq(attachments.todoId, id));

    for (const a of atts) {
      try {
        await del(a.blobUrl);
      } catch {
        // Blob deletion is best-effort
      }
    }

    await db.delete(attachments).where(eq(attachments.todoId, id));
    await db
      .delete(todos)
      .where(and(eq(todos.id, id), eq(todos.userId, user.id)));
  }

  return new NextResponse(null, { status: 204 });
}
