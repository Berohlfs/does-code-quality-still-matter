import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { todos } from "./todos";
import { users } from "./users";

export const todoShares = pgTable("todo_shares", {
  id: bigint({ mode: "number" }).primaryKey(),
  todoId: bigint("todo_id", { mode: "number" })
    .notNull()
    .references(() => todos.id),
  ownerUserId: bigint("owner_user_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  sharedWithEmail: text("shared_with_email").notNull(),
  sharedWithUserId: bigint("shared_with_user_id", { mode: "number" }).references(
    () => users.id
  ),
  role: text().notNull(), // "viewer" | "editor"
  status: text().notNull().default("pending"), // "pending" | "accepted"
  token: text().notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
