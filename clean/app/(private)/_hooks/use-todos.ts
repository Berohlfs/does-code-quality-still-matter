"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { todoKeys } from "./query-keys";
import type { TodoDto } from "@/dto/todo";

export function useTodos() {
  return useQuery({
    queryKey: todoKeys.all,
    queryFn: async () => {
      const { data } = await apiClient.get<TodoDto[]>("/todos");
      return data;
    },
  });
}
