import { z } from "zod/v4";

export const attachmentDto = z.object({
  id: z.string(),
  url: z.string(),
  originalName: z.string(),
  size: z.number(),
});

export type AttachmentDto = z.infer<typeof attachmentDto>;
