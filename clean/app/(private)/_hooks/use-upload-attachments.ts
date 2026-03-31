"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { todoKeys } from "./query-keys";
import type { AttachmentDto } from "@/dto/attachment";

export function useUploadAttachments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ todoId, files }: { todoId: number; files: File[] }) => {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      const { data } = await apiClient.post<AttachmentDto[]>(
        `/todos/${todoId}/attachments`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
  });
}
