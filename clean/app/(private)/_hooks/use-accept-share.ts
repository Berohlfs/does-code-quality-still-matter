"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { todoKeys } from "./query-keys";

export function useAcceptShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await apiClient.post<{ message: string }>(
        "/shares/accept",
        { token }
      );
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
