import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const todos = pgTable("todos", {
  id: bigint({ mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  parentId: bigint("parent_id", { mode: "number" }),
  title: text().notNull(),
  description: text().default(""),
  status: text().default("pending"),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
