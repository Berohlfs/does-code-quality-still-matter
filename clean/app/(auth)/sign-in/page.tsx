import Link from "next/link";
import { AuthCard } from "../_components/auth-card";
import { SignInForm } from "./_components/sign-in-form";

export default function SignInPage() {
  return (
    <AuthCard
      description="Sign in to manage your tasks"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-semibold text-primary hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <SignInForm />
    </AuthCard>
  );
}
