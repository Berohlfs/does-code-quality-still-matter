import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { db } from "@/db/client";
import { todos, todoShares } from "@/db/schemas";
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

const INVITE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(_request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) return validationError(paramsResult.error);
  const todoId = Number(paramsResult.data.id);

  const todo = await findUserTodo(todoId, user.id);
  if (!todo) return notFound();

  const shares = await db
    .select()
    .from(todoShares)
    .where(
      and(eq(todoShares.todoId, todoId), eq(todoShares.ownerUserId, user.id))
    );

  const result: ShareDto[] = shares.map((s) => ({
    id: s.id,
    todoId: s.todoId,
    sharedWithEmail: s.sharedWithEmail,
    role: s.role as ShareDto["role"],
    status: s.status as ShareDto["status"],
    expiresAt: s.expiresAt.toISOString(),
    createdAt: s.createdAt?.toISOString() ?? new Date().toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) return validationError(paramsResult.error);
  const todoId = Number(paramsResult.data.id);

  const todo = await findUserTodo(todoId, user.id);
  if (!todo) return notFound();

  // Only root todos can be shared
  if (todo.parentId) {
    return NextResponse.json(
      { error: "Only root todos can be shared" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const bodyResult = createShareBodyDto.safeParse(body);
  if (!bodyResult.success) return validationError(bodyResult.error);

  const { email, role } = bodyResult.data;

  // Cannot share with yourself
  if (email === user.email) {
    return NextResponse.json(
      { error: "Cannot share with yourself" },
      { status: 400 }
    );
  }

  // Check for existing active share
  const existing = await db
    .select()
    .from(todoShares)
    .where(
      and(
        eq(todoShares.todoId, todoId),
        eq(todoShares.sharedWithEmail, email)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const share = existing[0];
    if (share.status === "accepted") {
      return NextResponse.json(
        { error: "This todo is already shared with this user" },
        { status: 409 }
      );
    }
    // Remove expired/pending invite so a new one can be created
    await db.delete(todoShares).where(eq(todoShares.id, share.id));
  }

  const id = Date.now();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await db.insert(todoShares).values({
    id,
    todoId,
    ownerUserId: user.id,
    sharedWithEmail: email,
    role,
    status: "pending",
    token,
    expiresAt,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  emailProvider.sendMail({
    to: email,
    subject: `${user.name} shared a todo with you: ${todo.title}`,
    text: [
      `${user.name} has shared a todo with you as ${role === "editor" ? "an editor" : "a viewer"}.`,
      "",
      `Todo: ${todo.title}`,
      `Description: ${todo.description || "(none)"}`,
      "",
      `Accept the invite: ${appUrl}/accept-invite?token=${token}`,
      "",
      "This invite expires in 10 minutes.",
    ].join("\n"),
  });

  const result: ShareDto = {
    id,
    todoId,
    sharedWithEmail: email,
    role,
    status: "pending",
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  };

  return NextResponse.json(result, { status: 201 });
}
