import { NextResponse } from "next/server";
import { removeAuthCookie } from "@/app/api/auth/_helpers/jwt";

export async function POST() {
  await removeAuthCookie();
  return NextResponse.json({ ok: true });
}
