"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import type { AuthResponseDto } from "@/dto/user";

export function useSignUp() {
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const { data } = await apiClient.post<AuthResponseDto>("/auth/signup", { name, email, password });
      return data;
    },
    onSuccess: () => {
      router.push("/");
    },
  });
}
