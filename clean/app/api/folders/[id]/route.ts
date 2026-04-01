import { NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db } from "@/db/client";
import { folders, todos, attachments } from "@/db/schemas";
import { getRequestUser } from "@/app/api/_helpers/request";
import {
  folderParamsDto,
  updateFolderBodyDto,
  deleteFolderQueryDto,
  type FolderDto,
} from "@/dto/folder";

type Params = Promise<{ id: string }>;

export async function PUT(request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = folderParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return NextResponse.json(
      { error: paramsResult.error.issues[0].message },
      { status: 400 }
    );
  }
  const id = Number(paramsResult.data.id);

  const body = await request.json();
  const bodyResult = updateFolderBodyDto.safeParse(body);
  if (!bodyResult.success) {
    return NextResponse.json(
      { error: bodyResult.error.issues[0].message },
      { status: 400 }
    );
  }

  const rows = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { name } = bodyResult.data;

  await db
    .update(folders)
    .set({ name })
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)));

  const folder: FolderDto = { id, name };

  return NextResponse.json(folder);
}

export async function DELETE(
  request: Request,
  { params }: { params: Params }
) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = folderParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return NextResponse.json(
      { error: paramsResult.error.issues[0].message },
      { status: 400 }
    );
  }
  const id = Number(paramsResult.data.id);

  const url = new URL(request.url);
  const queryResult = deleteFolderQueryDto.safeParse({
    deleteContents: url.searchParams.get("deleteContents") ?? undefined,
  });
  const deleteContents = queryResult.success
    ? queryResult.data.deleteContents === "true"
    : false;

  const rows = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (deleteContents) {
    const folderTodos = await db
      .select({ id: todos.id })
      .from(todos)
      .where(and(eq(todos.folderId, id), eq(todos.userId, user.id)));

    const todoIds = folderTodos.map((t) => t.id);

    if (todoIds.length > 0) {
      const allDescendantAtts = await db.execute<{ blob_url: string }>(sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM todos WHERE folder_id = ${id} AND user_id = ${user.id}
          UNION ALL
          SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
        )
        SELECT blob_url FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
      `);

      for (const a of allDescendantAtts) {
        try {
          await del(a.blob_url);
        } catch {
          // Blob deletion is best-effort
        }
      }

      await db.execute(sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM todos WHERE folder_id = ${id} AND user_id = ${user.id}
          UNION ALL
          SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
        )
        DELETE FROM attachments WHERE todo_id IN (SELECT id FROM descendants)
      `);

      await db.execute(sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM todos WHERE folder_id = ${id} AND user_id = ${user.id}
          UNION ALL
          SELECT t.id FROM todos t INNER JOIN descendants d ON t.parent_id = d.id
        )
        DELETE FROM todos WHERE id IN (SELECT id FROM descendants)
      `);
    }
  } else {
    await db
      .update(todos)
      .set({ folderId: null })
      .where(and(eq(todos.folderId, id), eq(todos.userId, user.id)));
  }

  await db
    .delete(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)));

  return new NextResponse(null, { status: 204 });
}
