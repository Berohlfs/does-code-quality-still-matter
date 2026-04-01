"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { shareKeys } from "./query-keys";
import type { ShareDto, CreateShareBody } from "@/dto/share";

export function useCreateShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      todoId,
      data: input,
    }: {
      todoId: number;
      data: CreateShareBody;
    }) => {
      const { data } = await apiClient.post<ShareDto>(
        `/todos/${todoId}/shares`,
        input
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: shareKeys.byTodo(variables.todoId),
      });
    },
  });
}
