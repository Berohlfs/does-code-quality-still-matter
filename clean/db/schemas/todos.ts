import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { folders } from "./folders";

export const todos = pgTable("todos", {
  id: bigint({ mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  parentId: bigint("parent_id", { mode: "number" }),
  folderId: bigint("folder_id", { mode: "number" }).references(
    () => folders.id
  ),
  title: text().notNull(),
  description: text().default(""),
  status: text().default("pending"),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
