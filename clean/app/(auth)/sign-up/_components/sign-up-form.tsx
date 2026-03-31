"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpInput } from "../_validations/sign-up-schema";
import { useSignUp } from "../_hooks/use-sign-up";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";

export function SignUpForm() {
  const signUp = useSignUp();

  const { control, handleSubmit } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  function onSubmit(data: SignUpInput) {
    signUp.mutate({
      name: data.name,
      email: data.email,
      password: data.password,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {signUp.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {signUp.error.message}
        </div>
      )}
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              {...field}
              id="name"
              placeholder="Your name"
              autoComplete="name"
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Controller
        name="email"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor="signup-email">Email</FieldLabel>
            <Input
              {...field}
              id="signup-email"
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
            <FieldLabel htmlFor="signup-password">Password</FieldLabel>
            <Input
              {...field}
              id="signup-password"
              type="password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />
      <Button type="submit" className="w-full" disabled={signUp.isPending}>
        {signUp.isPending ? "Creating account..." : "Create Account"}
      </Button>
    </form>
  );
}
