"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { todoKeys } from "./query-keys";
import type { TodoDto, UpdateTodoBody } from "@/dto/todo";

export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data: input }: { id: number; data: UpdateTodoBody }) => {
      const { data } = await apiClient.put<TodoDto>(`/todos/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
