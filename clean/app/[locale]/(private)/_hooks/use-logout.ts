"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { apiClient } from "@/lib/api";

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post("/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      router.push("/sign-in");
    },
  });
}
