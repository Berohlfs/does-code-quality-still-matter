import { z } from "zod/v4";
import { todoStatus } from "@/dto/todo";

export const updateTodoSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  description: z.string().trim().optional(),
  status: todoStatus.optional(),
  dueDate: z.string().nullable().optional(),
});

export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
