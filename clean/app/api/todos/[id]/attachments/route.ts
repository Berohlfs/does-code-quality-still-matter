import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { put } from "@vercel/blob";
import { db } from "@/db/client";
import { attachments } from "@/db/schemas";
import {
  getRequestUser,
  validationError,
  findUserTodo,
  notFound,
} from "@/app/api/_helpers/request";
import { todoParamsDto, type AttachmentDto } from "@/dto/todo";

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB
const MAX_FILES = 10;

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const user = await getRequestUser();
  const rawParams = await params;

  const paramsResult = todoParamsDto.safeParse(rawParams);
  if (!paramsResult.success) {
    return validationError(paramsResult.error);
  }
  const todoId = Number(paramsResult.data.id);

  const todo = await findUserTodo(todoId, user.id);
  if (!todo) return notFound();

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files per request` },
      { status: 400 }
    );
  }

  const added: AttachmentDto[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 4 MB limit` },
        { status: 400 }
      );
    }

    const attId = randomBytes(6).toString("hex");
    const blob = await put(`${attId}-${file.name}`, file, {
      access: "public",
    });

    await db.insert(attachments).values({
      id: attId,
      todoId,
      blobUrl: blob.url,
      originalName: file.name,
      size: file.size,
    });

    added.push({
      id: attId,
      url: blob.url,
      originalName: file.name,
      size: file.size,
    });
  }

  return NextResponse.json(added);
}
