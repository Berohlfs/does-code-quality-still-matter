import { z } from "zod/v4";

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export function createSignUpSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("validation.nameRequired")),
    email: z.email(t("validation.emailInvalid")),
    password: z.string().min(6, t("validation.passwordMin")),
  });
}
