import { bigint, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const folders = pgTable("folders", {
  id: bigint({ mode: "number" }).primaryKey(),
  userId: bigint("user_id", { mode: "number" })
    .notNull()
    .references(() => users.id),
  name: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
