import Link from "next/link";
import { AuthCard } from "../_components/auth-card";
import { GoogleSignInButton } from "../_components/google-sign-in-button";
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
      <GoogleSignInButton />
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>
      <SignUpForm />
    </AuthCard>
  );
}
