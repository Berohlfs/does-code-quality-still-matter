import { z } from "zod/v4";

export const shareRole = z.enum(["viewer", "editor"]);

export type ShareRole = z.infer<typeof shareRole>;

export const shareStatus = z.enum(["pending", "accepted", "revoked"]);

export type ShareStatus = z.infer<typeof shareStatus>;

export const shareDto = z.object({
  id: z.number(),
  todoId: z.number(),
  inviteeEmail: z.string(),
  role: shareRole,
  status: shareStatus,
  expiresAt: z.string(),
  createdAt: z.string(),
});

export type ShareDto = z.infer<typeof shareDto>;

export const createShareBodyDto = z.object({
  email: z.email("Invalid email address"),
  role: shareRole,
});

export type CreateShareBody = z.infer<typeof createShareBodyDto>;

export const acceptShareBodyDto = z.object({
  token: z.string().min(1, "Token is required"),
});

export type AcceptShareBody = z.infer<typeof acceptShareBodyDto>;

export const shareParamsDto = z.object({
  id: z.string().regex(/^\d+$/, "Invalid todo ID"),
  shareId: z.string().regex(/^\d+$/, "Invalid share ID"),
});

export type ShareParams = z.infer<typeof shareParamsDto>;
