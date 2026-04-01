"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { folderKeys } from "./query-keys";
import type { FolderDto, CreateFolderBody } from "@/dto/folder";

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateFolderBody) => {
      const { data } = await apiClient.post<FolderDto>("/folders", input);
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: folderKeys.all }),
  });
}
