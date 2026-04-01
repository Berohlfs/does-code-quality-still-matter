import { z } from "zod/v4";

export const attachmentDto = z.object({
  id: z.string(),
  url: z.string(),
  originalName: z.string(),
  size: z.number(),
});

export type AttachmentDto = z.infer<typeof attachmentDto>;

export function toAttachmentDto(row: {
  id: string;
  blobUrl: string;
  originalName: string;
  size: number;
}): AttachmentDto {
  return {
    id: row.id,
    url: row.blobUrl,
    originalName: row.originalName,
    size: row.size,
  };
}
