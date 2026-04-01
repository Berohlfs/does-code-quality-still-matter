import { z } from "zod/v4";

export const signInSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignInInput = z.infer<typeof signInSchema>;

export function createSignInSchema(t: (key: string) => string) {
  return z.object({
    email: z.email(t("validation.emailInvalid")),
    password: z.string().min(1, t("validation.passwordRequired")),
  });
}
