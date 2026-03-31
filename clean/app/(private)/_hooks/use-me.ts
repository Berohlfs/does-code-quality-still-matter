"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { UserDto } from "@/dto/user";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await apiClient.get<UserDto>("/auth/me");
      return data;
    },
    retry: false,
  });
}
