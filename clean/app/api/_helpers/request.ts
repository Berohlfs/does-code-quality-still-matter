import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { todos } from "@/db/schemas";
import type { z } from "zod/v4";

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

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
