import { z } from "zod/v4";

export const signUpDto = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type SignUpDto = z.infer<typeof signUpDto>;

export const signInDto = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignInDto = z.infer<typeof signInDto>;

export const userDto = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
});

export type UserDto = z.infer<typeof userDto>;

export const authResponseDto = z.object({
  user: userDto,
});

export type AuthResponseDto = z.infer<typeof authResponseDto>;
