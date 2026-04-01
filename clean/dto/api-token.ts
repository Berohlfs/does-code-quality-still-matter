import { z } from "zod/v4";

export const createApiTokenDto = z.object({
  name: z.string().trim().min(1, "Token name is required").max(100),
});

export type CreateApiTokenDto = z.infer<typeof createApiTokenDto>;

export const apiTokenDto = z.object({
  id: z.number(),
  name: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export type ApiTokenDto = z.infer<typeof apiTokenDto>;

export const apiTokenCreatedDto = z.object({
  token: z.string(),
  apiToken: apiTokenDto,
});

export type ApiTokenCreatedDto = z.infer<typeof apiTokenCreatedDto>;
