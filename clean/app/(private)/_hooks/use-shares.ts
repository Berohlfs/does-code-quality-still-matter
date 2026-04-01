"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { shareKeys } from "./query-keys";
import type { ShareDto } from "@/dto/share";

export function useShares(todoId: number | null) {
  return useQuery({
    queryKey: shareKeys.byTodo(todoId!),
    queryFn: async () => {
      const { data } = await apiClient.get<ShareDto[]>(
        `/todos/${todoId}/shares`
      );
      return data;
    },
    enabled: todoId !== null,
  });
}
