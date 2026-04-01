import { z } from "zod/v4";

export const folderDto = z.object({
  id: z.number(),
  name: z.string(),
});

export type FolderDto = z.infer<typeof folderDto>;

export const createFolderBodyDto = z.object({
  name: z.string().trim().min(1, "Folder name is required"),
});

export type CreateFolderBody = z.infer<typeof createFolderBodyDto>;

export const updateFolderBodyDto = z.object({
  name: z.string().trim().min(1, "Folder name is required"),
});

export type UpdateFolderBody = z.infer<typeof updateFolderBodyDto>;

export const folderParamsDto = z.object({
  id: z.string().regex(/^\d+$/, "Invalid folder ID"),
});

export type FolderParams = z.infer<typeof folderParamsDto>;

export const deleteFolderQueryDto = z.object({
  deleteContents: z.enum(["true", "false"]).optional().default("false"),
});

export type DeleteFolderQuery = z.infer<typeof deleteFolderQueryDto>;
