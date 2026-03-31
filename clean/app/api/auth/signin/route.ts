import { NextResponse } from "next/server";
import { verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schemas";
import { signToken, setAuthCookie } from "@/lib/auth";
import { signInSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json();
  const result = signInSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const { email, password } = result.data;

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const user = rows[0];
  const valid = await verify(user.passwordHash, password);

  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const userData = { id: user.id, name: user.name, email: user.email };
  const token = await signToken(userData);
  await setAuthCookie(token);

  return NextResponse.json({ user: userData });
}
