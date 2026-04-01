"use client";

import { useDeleteFolder } from "@/app/(private)/_hooks/use-delete-folder";
import { useTodos } from "@/app/(private)/_hooks/use-todos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { FolderDto } from "@/dto/folder";

interface FolderDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: FolderDto | null;
  onDeleted: (folderId: number) => void;
}

export function FolderDeleteDialog({
  open,
  onOpenChange,
  folder,
  onDeleted,
}: FolderDeleteDialogProps) {
  const deleteFolder = useDeleteFolder();
  const { data: todos = [] } = useTodos();

  if (!folder) return null;

  const todosInFolder = todos.filter((t) => t.folderId === folder.id);
  const hasTodos = todosInFolder.length > 0;

  function handleDelete(deleteContents: boolean) {
    deleteFolder.mutate(
      { id: folder!.id, deleteContents },
      {
        onSuccess: () => {
          toast.success("Folder deleted");
          onDeleted(folder!.id);
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to delete folder"),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Folder</DialogTitle>
          <DialogDescription>
            {hasTodos
              ? `"${folder.name}" contains ${todosInFolder.length} task${todosInFolder.length > 1 ? "s" : ""}. How would you like to proceed?`
              : `Are you sure you want to delete "${folder.name}"?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {hasTodos ? (
            <>
              <Button
                variant="destructive"
                className="w-full"
                disabled={deleteFolder.isPending}
                onClick={() => handleDelete(true)}
              >
                Delete folder and all tasks
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                disabled={deleteFolder.isPending}
                onClick={() => handleDelete(false)}
              >
                Move tasks to default and delete folder
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              className="w-full"
              disabled={deleteFolder.isPending}
              onClick={() => handleDelete(false)}
            >
              Delete
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
