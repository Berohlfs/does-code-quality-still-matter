"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { folderKeys, todoKeys } from "./query-keys";

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      deleteContents,
    }: {
      id: number;
      deleteContents: boolean;
    }) => {
      await apiClient.delete(`/folders/${id}`, {
        params: { deleteContents },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: folderKeys.all });
      queryClient.invalidateQueries({ queryKey: todoKeys.all });
    },
  });
}
