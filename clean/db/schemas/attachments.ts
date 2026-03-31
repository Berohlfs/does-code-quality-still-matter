import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";
import { todos } from "./todos";

export const attachments = pgTable("attachments", {
  id: text().primaryKey(),
  todoId: bigint("todo_id", { mode: "number" })
    .notNull()
    .references(() => todos.id),
  blobUrl: text("blob_url").notNull(),
  originalName: text("original_name").notNull(),
  size: integer().notNull(),
});
