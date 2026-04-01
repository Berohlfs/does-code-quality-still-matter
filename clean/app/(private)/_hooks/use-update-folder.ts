"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { folderKeys } from "./query-keys";
import type { FolderDto, UpdateFolderBody } from "@/dto/folder";

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data: input,
    }: {
      id: number;
      data: UpdateFolderBody;
    }) => {
      const { data } = await apiClient.put<FolderDto>(
        `/folders/${id}`,
        input
      );
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: folderKeys.all }),
  });
}
