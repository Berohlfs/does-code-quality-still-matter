import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { folders } from "@/db/schemas";
import { getRequestUser } from "@/app/api/_helpers/request";
import { createFolderBodyDto, type FolderDto } from "@/dto/folder";

export async function GET() {
  const user = await getRequestUser();

  const rows = await db
    .select()
    .from(folders)
    .where(eq(folders.userId, user.id))
    .orderBy(folders.createdAt);

  const result: FolderDto[] = rows.map((f) => ({
    id: f.id,
    name: f.name,
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  const body = await request.json();
  const result = createFolderBodyDto.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const { name } = result.data;
  const id = Date.now();

  await db.insert(folders).values({
    id,
    userId: user.id,
    name,
  });

  const folder: FolderDto = { id, name };

  return NextResponse.json(folder, { status: 201 });
}
