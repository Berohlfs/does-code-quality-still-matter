import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { todos } from "./todos";

export const shares = pgTable("shares", {
  id: bigint({ mode: "number" }).primaryKey(),
  todoId: bigint("todo_id", { mode: "number" })
    .notNull()
    .references(() => todos.id),
  ownerUserId: bigint("owner_user_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  sharedUserId: bigint("shared_user_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  role: text().notNull(),
  status: text().notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
