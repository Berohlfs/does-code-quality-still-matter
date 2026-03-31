import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth/auth-form";

export default async function LoginPage() {
  const user = await getAuthUser();
  if (user) redirect("/");

  return <AuthForm />;
}
