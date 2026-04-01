import { z } from "zod/v4";
import { attachmentDto } from "./attachment";

export const todoStatus = z.enum(["pending", "in-progress", "done"]);

export type TodoStatus = z.infer<typeof todoStatus>;

export const todoDto = z.object({
  id: z.number(),
  parentId: z.number().nullable(),
  title: z.string(),
  description: z.string(),
  status: todoStatus,
  dueDate: z.string().nullable(),
  attachments: z.array(attachmentDto),
});

export type TodoDto = z.infer<typeof todoDto>;

export const createTodoBodyDto = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  status: todoStatus.optional(),
  dueDate: z.string().nullable().optional(),
  parentId: z.number().nullable().optional(),
});

export type CreateTodoBody = z.infer<typeof createTodoBodyDto>;

export const updateTodoBodyDto = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  description: z.string().trim().optional(),
  status: todoStatus.optional(),
  dueDate: z.string().nullable().optional(),
});

export type UpdateTodoBody = z.infer<typeof updateTodoBodyDto>;

export const todoParamsDto = z.object({
  id: z.string().regex(/^\d+$/, "Invalid todo ID"),
});

export type TodoParams = z.infer<typeof todoParamsDto>;

export const deleteTodoQueryDto = z.object({
  cascade: z.enum(["true", "false"]).optional().default("true"),
});

export type DeleteTodoQuery = z.infer<typeof deleteTodoQueryDto>;

export const attachmentParamsDto = z.object({
  id: z.string().regex(/^\d+$/, "Invalid todo ID"),
  attId: z.string().min(1, "Invalid attachment ID"),
});

export type AttachmentParams = z.infer<typeof attachmentParamsDto>;
