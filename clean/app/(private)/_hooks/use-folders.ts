"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { folderKeys } from "./query-keys";
import type { FolderDto } from "@/dto/folder";

export function useFolders() {
  return useQuery({
    queryKey: folderKeys.all,
    queryFn: async () => {
      const { data } = await apiClient.get<FolderDto[]>("/folders");
      return data;
    },
  });
}
