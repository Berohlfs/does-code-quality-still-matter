"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignInInput } from "../_validations/sign-in-schema";
import { useSignIn } from "../_hooks/use-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";

export function SignInForm() {
  const signIn = useSignIn();

  const { control, handleSubmit } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(data: SignInInput) {
    signIn.mutate({ email: data.email, password: data.password });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {signIn.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {signIn.error.message}
        </div>
      )}
      <Controller
        name="email"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              {...field}
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Controller
        name="password"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              {...field}
              id="password"
              type="password"
              placeholder="Your password"
              autoComplete="current-password"
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Button type="submit" className="w-full" disabled={signIn.isPending}>
        {signIn.isPending ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}
