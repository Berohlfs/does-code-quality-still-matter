import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db/client";
import { todos, attachments } from "@/db/schemas";
import {
  getRequestUser,
  validationError,
  findUserTodo,
  notFound,
} from "@/app/api/_helpers/request";
import {
  todoParamsDto,
  updateTodoBodyDto,
  deleteTodoQueryDto,
  type TodoDto,
} from "@/dto/todo";
import { toAttachmentDto } from "@/dto/attachment";

type Params = Promise<{ id: string }>;

async function deleteBlobs(urls: string[]) {
  for (const url of urls) {
    try {
      await del(url);
    } catch {
      // Blob deletion is best-effort
    }
  }
}

export async function PUT(request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return validationError(paramsResult.error);
  }
  const id = Number(paramsResult.data.id);

  const body = await request.json();
  const bodyResult = updateTodoBodyDto.safeParse(body);
  if (!bodyResult.success) {
    return validationError(bodyResult.error);
  }

  const existing = await findUserTodo(id, user.id);
  if (!existing) return notFound();

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
    attachments: atts.map(toAttachmentDto),
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
    return validationError(paramsResult.error);
  }
  const id = Number(paramsResult.data.id);

  const url = new URL(request.url);
  const queryResult = deleteTodoQueryDto.safeParse({
    cascade: url.searchParams.get("cascade") ?? undefined,
  });
  const cascade = queryResult.success
    ? queryResult.data.cascade !== "false"
    : true;

  const todo = await findUserTodo(id, user.id);
  if (!todo) return notFound();

  if (cascade) {
    const descendantsCte = sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM todos WHERE id = ${id} AND user_id = ${user.id}
        UNION ALL
        SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
      )
    `;

    const descendantAtts = await db.execute<{ blob_url: string }>(
      sql`${descendantsCte} SELECT blob_url FROM attachments WHERE todo_id IN (SELECT id FROM descendants)`
    );

    await deleteBlobs(descendantAtts.map((a) => a.blob_url));

    await db.execute(
      sql`${descendantsCte} DELETE FROM attachments WHERE todo_id IN (SELECT id FROM descendants)`
    );
    await db.execute(
      sql`${descendantsCte} DELETE FROM todos WHERE id IN (SELECT id FROM descendants)`
    );
  } else {
    await db
      .update(todos)
      .set({ parentId: todo.parentId })
      .where(and(eq(todos.parentId, id), eq(todos.userId, user.id)));

    const atts = await db
      .select({ blobUrl: attachments.blobUrl })
      .from(attachments)
      .where(eq(attachments.todoId, id));

    await deleteBlobs(atts.map((a) => a.blobUrl));

    await db.delete(attachments).where(eq(attachments.todoId, id));
    await db
      .delete(todos)
      .where(and(eq(todos.id, id), eq(todos.userId, user.id)));
  }

  return new NextResponse(null, { status: 204 });
}
