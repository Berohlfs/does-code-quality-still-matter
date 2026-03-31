import { z } from "zod/v4";

// ── Auth ──

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signInSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;

// ── Todos ──

export const todoStatus = z.enum(["pending", "in-progress", "done"]);

export type TodoStatus = z.infer<typeof todoStatus>;

export const createTodoSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  status: todoStatus.optional(),
  dueDate: z.string().nullable().optional(),
  parentId: z.number().nullable().optional(),
});

export const updateTodoSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  description: z.string().trim().optional(),
  status: todoStatus.optional(),
  dueDate: z.string().nullable().optional(),
});

export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;

// ── Notes ──

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  content: z.string().trim().optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  content: z.string().trim().optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
