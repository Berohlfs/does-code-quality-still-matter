import { z } from "zod/v4";
import { todoStatus } from "@/dto/todo";

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  status: todoStatus.optional(),
  dueDate: z.string().nullable().optional(),
  parentId: z.number().nullable().optional(),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
