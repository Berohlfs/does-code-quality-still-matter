import { z } from "zod/v4";

export const shareRole = z.enum(["viewer", "editor"]);

export type ShareRole = z.infer<typeof shareRole>;

export const shareStatus = z.enum(["pending", "accepted"]);

export type ShareStatus = z.infer<typeof shareStatus>;

export const shareDto = z.object({
  id: z.number(),
  todoId: z.number(),
  todoTitle: z.string(),
  ownerName: z.string(),
  sharedUserEmail: z.string(),
  sharedUserName: z.string(),
  role: shareRole,
  status: shareStatus,
  expiresAt: z.string(),
});

export type ShareDto = z.infer<typeof shareDto>;

export const createShareBodyDto = z.object({
  email: z.email("Invalid email address"),
  role: shareRole,
});

export type CreateShareBody = z.infer<typeof createShareBodyDto>;

export const pendingInviteDto = z.object({
  id: z.number(),
  todoId: z.number(),
  todoTitle: z.string(),
  ownerName: z.string(),
  role: shareRole,
  expiresAt: z.string(),
});

export type PendingInviteDto = z.infer<typeof pendingInviteDto>;

export const shareParamsDto = z.object({
  id: z.string().regex(/^\d+$/, "Invalid todo ID"),
  shareId: z.string().regex(/^\d+$/, "Invalid share ID"),
});

export type ShareParams = z.infer<typeof shareParamsDto>;
