import { NextResponse } from "next/server";
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schemas";
import { signToken, setAuthCookie } from "@/app/api/auth/_helpers/jwt";
import { validationError } from "@/app/api/_helpers/request";
import { signUpDto, type AuthResponseDto } from "@/dto/user";

export async function POST(request: Request) {
  const body = await request.json();
  const result = signUpDto.safeParse(body);

  if (!result.success) {
    return validationError(result.error);
  }

  const { name, email, password } = result.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 }
    );
  }

  const id = Date.now();
  const passwordHash = await hash(password);

  await db.insert(users).values({
    id,
    name,
    email: normalizedEmail,
    passwordHash,
  });

  const user = { id, name, email: normalizedEmail };
  const token = await signToken(user);
  await setAuthCookie(token);

  return NextResponse.json(
    { user } satisfies AuthResponseDto,
    { status: 201 }
  );
}
