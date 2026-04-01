import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { todos, todoShares } from "@/db/schemas";

/**
 * Check if a user has access to a todo via sharing.
 * Walks up the parent chain to find a shared root todo.
 * Returns the share record if found, null otherwise.
 */
export async function findSharedTodoAccess(
  todoId: number,
  userId: number
): Promise<{ role: string; ownerUserId: number } | null> {
  // Check if this todo itself is shared with the user
  const directShare = await db
    .select({ role: todoShares.role, ownerUserId: todoShares.ownerUserId })
    .from(todoShares)
    .where(
      and(
        eq(todoShares.todoId, todoId),
        eq(todoShares.sharedWithUserId, userId),
        eq(todoShares.status, "accepted")
      )
    )
    .limit(1);

  if (directShare.length > 0) return directShare[0];

  // Walk up the parent chain
  const todo = await db
    .select({ parentId: todos.parentId })
    .from(todos)
    .where(eq(todos.id, todoId))
    .limit(1);

  if (todo.length === 0 || !todo[0].parentId) return null;

  return findSharedTodoAccess(todo[0].parentId, userId);
}
