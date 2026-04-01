"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { shareKeys, todoKeys } from "./query-keys";

export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shareId: number) => {
      await apiClient.post(`/shares/${shareId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shareKeys.pending });
      queryClient.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
}
