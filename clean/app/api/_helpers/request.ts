import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { todos, todoShares } from "@/db/schemas";
import type { z } from "zod/v4";
import type { ShareRole } from "@/dto/share";

interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export async function getRequestUser(): Promise<AuthUser> {
  const h = await headers();
  const id = h.get("x-user-id");
  const email = h.get("x-user-email");
  const name = h.get("x-user-name");

  if (!id || !email || !name) {
    throw new Error("User not authenticated");
  }

  return { id: Number(id), email, name };
}

export function validationError(error: z.ZodError) {
  return NextResponse.json(
    { error: error.issues[0].message },
    { status: 400 }
  );
}

export async function findUserTodo(todoId: number, userId: number) {
  const rows = await db
    .select()
    .from(todos)
    .where(and(eq(todos.id, todoId), eq(todos.userId, userId)))
    .limit(1);

  return rows[0] ?? null;
}

export type TodoAccess =
  | { type: "owner"; todo: Awaited<ReturnType<typeof findUserTodo>> & {} }
  | { type: "shared"; todo: Awaited<ReturnType<typeof findUserTodo>> & {}; role: ShareRole };

export async function findAccessibleTodo(
  todoId: number,
  user: AuthUser
): Promise<TodoAccess | null> {
  // Check if user owns the todo
  const owned = await findUserTodo(todoId, user.id);
  if (owned) return { type: "owner", todo: owned };

  // Check if user has shared access by walking up to find the shared root
  const todo = await db
    .select()
    .from(todos)
    .where(eq(todos.id, todoId))
    .limit(1);

  if (todo.length === 0) return null;

  // Find all ancestor IDs (including self) using recursive CTE
  const ancestors = await db.execute<{ id: number }>(sql`
    WITH RECURSIVE chain AS (
      SELECT id, parent_id FROM todos WHERE id = ${todoId}
      UNION ALL
      SELECT t.id, t.parent_id FROM todos t INNER JOIN chain c ON t.id = c.parent_id
    )
    SELECT id FROM chain
  `);

  const ancestorIds = ancestors.map((a) => a.id);

  // Check if any ancestor is shared with this user
  for (const ancestorId of ancestorIds) {
    const shares = await db
      .select({ role: todoShares.role })
      .from(todoShares)
      .where(
        and(
          eq(todoShares.todoId, ancestorId),
          eq(todoShares.inviteeEmail, user.email),
          eq(todoShares.status, "accepted")
        )
      )
      .limit(1);

    if (shares.length > 0) {
      return {
        type: "shared",
        todo: todo[0],
        role: shares[0].role as ShareRole,
      };
    }
  }

  return null;
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}
