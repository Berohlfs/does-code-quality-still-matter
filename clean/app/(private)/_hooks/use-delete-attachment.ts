"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { todoKeys } from "./query-keys";

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ todoId, attId }: { todoId: number; attId: string }) => {
      await apiClient.delete(`/todos/${todoId}/attachments/${attId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
