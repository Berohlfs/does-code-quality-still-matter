import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { todos, todoShares, users } from "@/db/schemas";
import {
  getRequestUser,
  validationError,
  notFound,
} from "@/app/api/_helpers/request";
import { todoParamsDto } from "@/dto/todo";
import { createShareBodyDto, type ShareDto } from "@/dto/share";
import { emailProvider } from "@/providers/email";

type Params = Promise<{ id: string }>;

const INVITE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(_request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return validationError(paramsResult.error);
  }
  const todoId = Number(paramsResult.data.id);

  const todo = await db
    .select({ id: todos.id })
    .from(todos)
    .where(and(eq(todos.id, todoId), eq(todos.userId, user.id)))
    .limit(1);

  if (todo.length === 0) return notFound();

  const shares = await db
    .select()
    .from(todoShares)
    .where(eq(todoShares.todoId, todoId))
    .orderBy(todoShares.createdAt);

  const result: ShareDto[] = shares.map((s) => ({
    id: s.id,
    todoId: s.todoId,
    inviteeEmail: s.inviteeEmail,
    role: s.role as ShareDto["role"],
    status: s.status as ShareDto["status"],
    expiresAt: s.expiresAt.toISOString(),
    createdAt: s.createdAt!.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return validationError(paramsResult.error);
  }
  const todoId = Number(paramsResult.data.id);

  const body = await request.json();
  const bodyResult = createShareBodyDto.safeParse(body);
  if (!bodyResult.success) {
    return validationError(bodyResult.error);
  }

  const { email, role } = bodyResult.data;

  const todo = await db
    .select({ id: todos.id, title: todos.title })
    .from(todos)
    .where(and(eq(todos.id, todoId), eq(todos.userId, user.id)))
    .limit(1);

  if (todo.length === 0) return notFound();

  if (email === user.email) {
    return NextResponse.json(
      { error: "Cannot share with yourself" },
      { status: 400 }
    );
  }

  const invitee = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (invitee.length === 0) {
    return NextResponse.json(
      { error: "User not found with that email" },
      { status: 404 }
    );
  }

  const existing = await db
    .select({ id: todoShares.id })
    .from(todoShares)
    .where(
      and(
        eq(todoShares.todoId, todoId),
        eq(todoShares.inviteeEmail, email),
        eq(todoShares.status, "accepted")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "This user already has access to this todo" },
      { status: 409 }
    );
  }

  const id = Date.now();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db.insert(todoShares).values({
    id,
    todoId,
    ownerUserId: user.id,
    inviteeEmail: email,
    role,
    status: "pending",
    token,
    expiresAt,
  });

  const share: ShareDto = {
    id,
    todoId,
    inviteeEmail: email,
    role: role as ShareDto["role"],
    status: "pending",
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  };

  emailProvider.sendMail({
    to: email,
    subject: `${user.name} shared a todo with you: ${todo[0].title}`,
    text: [
      `${user.name} has invited you to ${role === "editor" ? "edit" : "view"} a todo.`,
      "",
      `Title: ${todo[0].title}`,
      `Role: ${role}`,
      "",
      `Accept the invite by using this token: ${token}`,
      "",
      "This invite expires in 10 minutes.",
    ].join("\n"),
  });

  return NextResponse.json(share, { status: 201 });
}
