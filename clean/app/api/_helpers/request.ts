import { headers } from "next/headers";

interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export async function getRequestUser(): Promise<AuthUser> {
  const h = await headers();
  const id = h.get("x-user-id");
  const email = h.get("x-user-email");
  const name = h.get("x-user-name");

  if (!id || !email || !name) {
    throw new Error("User not authenticated");
  }

  return { id: Number(id), email, name };
}
