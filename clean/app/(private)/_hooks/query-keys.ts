export const todoKeys = {
  all: ["todos"] as const,
};

export const shareKeys = {
  byTodo: (todoId: number) => ["shares", todoId] as const,
};
