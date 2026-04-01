"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { shareKeys, todoKeys } from "./query-keys";
import type { ShareDto, CreateShareBody } from "@/dto/share";

export function useShares(todoId: number) {
  return useQuery({
    queryKey: shareKeys.byTodo(todoId),
    queryFn: async () => {
      const { data } = await apiClient.get<ShareDto[]>(
        `/todos/${todoId}/shares`
      );
      return data;
    },
  });
}

export function useCreateShare(todoId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShareBody) => {
      const { data } = await apiClient.post<ShareDto>(
        `/todos/${todoId}/shares`,
        input
      );
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: shareKeys.byTodo(todoId) }),
  });
}

export function useRevokeShare(todoId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shareId: number) => {
      await apiClient.delete(`/todos/${todoId}/shares/${shareId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shareKeys.byTodo(todoId) });
      queryClient.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
}

export function useAcceptShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await apiClient.post(`/shares/accept?token=${token}`);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
