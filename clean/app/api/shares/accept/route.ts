import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { todoShares, users } from "@/db/schemas";
import { getRequestUser } from "@/app/api/_helpers/request";

export async function POST(request: Request) {
  const user = await getRequestUser();

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(todoShares)
    .where(eq(todoShares.token, token))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Invalid or expired invite" },
      { status: 404 }
    );
  }

  const share = rows[0];

  if (share.status === "accepted") {
    return NextResponse.json(
      { error: "Invite already accepted" },
      { status: 409 }
    );
  }

  if (new Date() > share.expiresAt) {
    await db.delete(todoShares).where(eq(todoShares.id, share.id));
    return NextResponse.json(
      { error: "Invite has expired" },
      { status: 410 }
    );
  }

  // Verify the accepting user's email matches the invite
  if (share.sharedWithEmail !== user.email) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  await db
    .update(todoShares)
    .set({
      status: "accepted",
      sharedWithUserId: user.id,
    })
    .where(eq(todoShares.id, share.id));

  return NextResponse.json({ message: "Invite accepted" });
}
