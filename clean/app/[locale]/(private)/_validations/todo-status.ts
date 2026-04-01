import { z } from "zod/v4";

export const todoStatus = z.enum(["pending", "in-progress", "done"]);

export type TodoStatus = z.infer<typeof todoStatus>;
