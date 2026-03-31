import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const notes = pgTable("notes", {
  id: bigint({ mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  title: text().notNull(),
  content: text().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});