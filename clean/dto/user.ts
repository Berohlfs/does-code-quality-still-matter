import { z } from "zod/v4";

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
