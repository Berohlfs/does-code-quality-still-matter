export const todoKeys = {
  all: ["todos"] as const,
};

export const shareKeys = {
  all: ["shares"] as const,
  byTodo: (todoId: number) => ["shares", todoId] as const,
  pending: ["shares", "pending"] as const,
};
