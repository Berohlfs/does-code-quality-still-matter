"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { shareKeys } from "./query-keys";

export function useRevokeShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      todoId,
      shareId,
    }: {
      todoId: number;
      shareId: number;
    }) => {
      await apiClient.delete(`/todos/${todoId}/shares/${shareId}`);
    },
    onSuccess: (_data, { todoId }) =>
      queryClient.invalidateQueries({ queryKey: shareKeys.byTodo(todoId) }),
  });
}
