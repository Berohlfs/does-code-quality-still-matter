"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";
import type { AuthResponseDto } from "@/dto/user";

export function useSignIn() {
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data } = await apiClient.post<AuthResponseDto>("/auth/signin", { email, password });
      return data;
    },
    onSuccess: () => {
      router.push("/");
    },
  });
}
