"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { todoKeys } from "./query-keys";
import type { TodoDto, CreateTodoBody } from "@/dto/todo";

export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTodoBody) => {
      const { data } = await apiClient.post<TodoDto>("/todos", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
