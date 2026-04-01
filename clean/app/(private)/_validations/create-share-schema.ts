import { z } from "zod/v4";
import { shareRole } from "@/dto/share";

export const createShareSchema = z.object({
  email: z.email("Invalid email address"),
  role: shareRole,
});

export type CreateShareForm = z.infer<typeof createShareSchema>;
