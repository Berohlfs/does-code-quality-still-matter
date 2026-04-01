import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { todoShares } from "@/db/schemas";
import { getRequestUser, validationError } from "@/app/api/_helpers/request";
import { acceptShareBodyDto } from "@/dto/share";

export async function POST(request: Request) {
  const user = await getRequestUser();
  const body = await request.json();

  const result = acceptShareBodyDto.safeParse(body);
  if (!result.success) {
    return validationError(result.error);
  }

  const { token } = result.data;

  const shares = await db
    .select()
    .from(todoShares)
    .where(eq(todoShares.token, token))
    .limit(1);

  if (shares.length === 0) {
    return NextResponse.json(
      { error: "Invalid invite token" },
      { status: 404 }
    );
  }

  const share = shares[0];

  if (share.status !== "pending") {
    return NextResponse.json(
      { error: `Invite has already been ${share.status}` },
      { status: 400 }
    );
  }

  if (new Date() > share.expiresAt) {
    return NextResponse.json(
      { error: "Invite has expired" },
      { status: 410 }
    );
  }

  if (share.inviteeEmail !== user.email) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 }
    );
  }

  await db
    .update(todoShares)
    .set({ status: "accepted" })
    .where(eq(todoShares.id, share.id));

  return NextResponse.json({ message: "Invite accepted" });
}
