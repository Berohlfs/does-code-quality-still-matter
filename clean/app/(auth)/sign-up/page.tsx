import Link from "next/link";
import { AuthCard } from "../_components/auth-card";
import { SignUpForm } from "./_components/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthCard
      description="Create an account to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
