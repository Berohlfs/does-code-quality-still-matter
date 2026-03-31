import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { todos, attachments } from "@/db/schemas";
import type { Todo } from "./types";

export async function fetchTodosForUser(userId: number): Promise<Todo[]> {
  const rows = await db
    .select()
    .from(todos)
    .where(eq(todos.userId, userId))
    .orderBy(todos.createdAt);

  const todoIds = rows.map((t) => t.id);

  const atts =
    todoIds.length > 0
      ? await db
          .select()
          .from(attachments)
          .where(inArray(attachments.todoId, todoIds))
      : [];

  return rows.map((t) => ({
    id: t.id,
    parentId: t.parentId,
    title: t.title,
    description: t.description ?? "",
    status: (t.status ?? "pending") as Todo["status"],
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
}
