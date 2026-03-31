import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schemas";
import { getRequestUser } from "@/lib/request";

export async function GET() {
  const authUser = await getRequestUser();

  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, authUser.id))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  return NextResponse.json(rows[0]);
}
