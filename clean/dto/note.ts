import { z } from "zod/v4";

export const noteDto = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type NoteDto = z.infer<typeof noteDto>;

export const createNoteBodyDto = z.object({
  title: z.string().trim().min(1, "Title is required"),
  content: z.string().trim().optional(),
});

export type CreateNoteBody = z.infer<typeof createNoteBodyDto>;

export const updateNoteBodyDto = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  content: z.string().trim().optional(),
});

export type UpdateNoteBody = z.infer<typeof updateNoteBodyDto>;

export const noteParamsDto = z.object({
  id: z.string().regex(/^\d+$/, "Invalid note ID"),
});

export type NoteParams = z.infer<typeof noteParamsDto>;
