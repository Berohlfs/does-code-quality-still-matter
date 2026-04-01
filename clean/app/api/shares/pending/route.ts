import { NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { shares, todos, users } from "@/db/schemas";
import { getRequestUser } from "@/app/api/_helpers/request";
import type { PendingInviteDto } from "@/dto/share";

export async function GET() {
  const user = await getRequestUser();

  const rows = await db
    .select({
      id: shares.id,
      todoId: shares.todoId,
      todoTitle: todos.title,
      ownerName: users.name,
      role: shares.role,
      expiresAt: shares.expiresAt,
    })
    .from(shares)
    .innerJoin(todos, eq(todos.id, shares.todoId))
    .innerJoin(users, eq(users.id, shares.ownerUserId))
    .where(
      and(
        eq(shares.sharedUserId, user.id),
        eq(shares.status, "pending"),
        gt(shares.expiresAt, new Date())
      )
    );

  const result: PendingInviteDto[] = rows.map((r) => ({
    id: r.id,
    todoId: r.todoId,
    todoTitle: r.todoTitle,
    ownerName: r.ownerName,
    role: r.role as PendingInviteDto["role"],
    expiresAt: r.expiresAt!.toISOString(),
  }));

  return NextResponse.json(result);
}
