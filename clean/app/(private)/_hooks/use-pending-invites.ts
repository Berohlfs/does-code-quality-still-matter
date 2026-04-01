"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { shareKeys } from "./query-keys";
import type { PendingInviteDto } from "@/dto/share";

export function usePendingInvites() {
  return useQuery({
    queryKey: shareKeys.pending,
    queryFn: async () => {
      const { data } = await apiClient.get<PendingInviteDto[]>(
        "/shares/pending"
      );
      return data;
    },
    refetchInterval: 30_000,
  });
}
