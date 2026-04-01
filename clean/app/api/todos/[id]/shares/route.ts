import { NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { todos, shares, users } from "@/db/schemas";
import {
  getRequestUser,
  validationError,
  findUserTodo,
  notFound,
} from "@/app/api/_helpers/request";
import { todoParamsDto } from "@/dto/todo";
import { createShareBodyDto, type ShareDto } from "@/dto/share";
import { emailProvider } from "@/providers/email";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) return validationError(paramsResult.error);

  const todoId = Number(paramsResult.data.id);

  const todo = await findUserTodo(todoId, user.id);
  if (!todo) return notFound();

  const rows = await db
    .select({
      id: shares.id,
      todoId: shares.todoId,
      role: shares.role,
      status: shares.status,
      expiresAt: shares.expiresAt,
      sharedUserEmail: users.email,
      sharedUserName: users.name,
    })
    .from(shares)
    .innerJoin(users, eq(users.id, shares.sharedUserId))
    .where(
      and(
        eq(shares.todoId, todoId),
        eq(shares.ownerUserId, user.id),
        gt(shares.expiresAt, new Date())
      )
    );

  const result: ShareDto[] = rows.map((r) => ({
    id: r.id,
    todoId: r.todoId,
    todoTitle: todo.title,
    ownerName: user.name,
    sharedUserEmail: r.sharedUserEmail,
    sharedUserName: r.sharedUserName,
    role: r.role as ShareDto["role"],
    status: r.status as ShareDto["status"],
    expiresAt: r.expiresAt!.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) return validationError(paramsResult.error);

  const todoId = Number(paramsResult.data.id);

  const body = await request.json();
  const bodyResult = createShareBodyDto.safeParse(body);
  if (!bodyResult.success) return validationError(bodyResult.error);

  const { email, role } = bodyResult.data;

  const todo = await findUserTodo(todoId, user.id);
  if (!todo) return notFound();

  if (todo.parentId) {
    return NextResponse.json(
      { error: "Only root-level todos can be shared" },
      { status: 400 }
    );
  }

  if (email === user.email) {
    return NextResponse.json(
      { error: "Cannot share with yourself" },
      { status: 400 }
    );
  }

  const targetUser = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (targetUser.length === 0) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  const existing = await db
    .select({ id: shares.id })
    .from(shares)
    .where(
      and(
        eq(shares.todoId, todoId),
        eq(shares.sharedUserId, targetUser[0].id),
        gt(shares.expiresAt, new Date())
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "An active share already exists for this user" },
      { status: 409 }
    );
  }

  const id = Date.now();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(shares).values({
    id,
    todoId,
    ownerUserId: user.id,
    sharedUserId: targetUser[0].id,
    role,
    status: "pending",
    expiresAt,
  });

  emailProvider.sendMail({
    to: email,
    subject: `${user.name} shared a todo with you: ${todo.title}`,
    text: [
      `${user.name} has invited you to collaborate on a todo.`,
      "",
      `Todo: ${todo.title}`,
      `Role: ${role}`,
      `This invite expires in 10 minutes.`,
      "",
      "Log in to accept the invite.",
    ].join("\n"),
  });

  const share: ShareDto = {
    id,
    todoId,
    todoTitle: todo.title,
    ownerName: user.name,
    sharedUserEmail: targetUser[0].email,
    sharedUserName: targetUser[0].name,
    role: role as ShareDto["role"],
    status: "pending",
    expiresAt: expiresAt.toISOString(),
  };

  return NextResponse.json(share, { status: 201 });
}
