import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { todoShares } from "@/db/schemas";
import { getRequestUser, validationError, notFound } from "@/app/api/_helpers/request";
import { shareParamsDto } from "@/dto/share";

type Params = Promise<{ id: string; shareId: string }>;

export async function DELETE(
  _request: Request,
  { params }: { params: Params }
) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = shareParamsDto.safeParse(rawParams);
  if (!paramsResult.success) return validationError(paramsResult.error);
  const shareId = Number(paramsResult.data.shareId);

  const rows = await db
    .select()
    .from(todoShares)
    .where(
      and(
        eq(todoShares.id, shareId),
        eq(todoShares.ownerUserId, user.id)
      )
    )
    .limit(1);

  if (rows.length === 0) return notFound("Share not found");

  await db.delete(todoShares).where(eq(todoShares.id, shareId));

  return new NextResponse(null, { status: 204 });
}
