"use client";

import { useState } from "react";
import { useFolders } from "@/app/(private)/_hooks/use-folders";
import { useCreateFolder } from "@/app/(private)/_hooks/use-create-folder";
import { useUpdateFolder } from "@/app/(private)/_hooks/use-update-folder";
import { useDashboard } from "./dashboard-context";
import { FolderDeleteDialog } from "./folder-delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderOpen,
  Inbox,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { FolderDto } from "@/dto/folder";

export function FolderSidebar() {
  const { data: folders = [] } = useFolders();
  const { activeFolder, setActiveFolder } = useDashboard();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteFolder, setDeleteFolder] = useState<FolderDto | null>(null);

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    createFolder.mutate(
      { name },
      {
        onSuccess: () => {
          setNewName("");
          setIsCreating(false);
          toast.success("Folder created");
        },
        onError: () => toast.error("Failed to create folder"),
      }
    );
  }

  function handleUpdate(id: number) {
    const name = editName.trim();
    if (!name) return;
    updateFolder.mutate(
      { id, data: { name } },
      {
        onSuccess: () => {
          setEditingId(null);
          toast.success("Folder renamed");
        },
        onError: () => toast.error("Failed to rename folder"),
      }
    );
  }

  function startEdit(folder: FolderDto) {
    setEditingId(folder.id);
    setEditName(folder.name);
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-1 border-r bg-muted/20 p-3">
      <p className="mb-1 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Folders
      </p>

      <button
        onClick={() => setActiveFolder(null)}
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
          activeFolder === null
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Inbox className="h-4 w-4" />
        All Tasks
      </button>

      {folders.map((folder) =>
        editingId === folder.id ? (
          <div key={folder.id} className="flex items-center gap-1 px-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUpdate(folder.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              className="h-7 text-sm"
              autoFocus
            />
            <button
              onClick={() => handleUpdate(folder.id)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div
            key={folder.id}
            className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${
              activeFolder === folder.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <button
              onClick={() => setActiveFolder(folder.id)}
              className="flex flex-1 items-center gap-2 overflow-hidden"
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">{folder.name}</span>
            </button>
            <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={() => startEdit(folder)}
                className="rounded p-0.5 hover:bg-background"
                title="Rename"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDeleteFolder(folder)}
                className="rounded p-0.5 hover:bg-background"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          </div>
        )
      )}

      {isCreating ? (
        <div className="flex items-center gap-1 px-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setIsCreating(false);
                setNewName("");
              }
            }}
            placeholder="Folder name"
            className="h-7 text-sm"
            autoFocus
          />
          <button
            onClick={handleCreate}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setIsCreating(false);
              setNewName("");
            }}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-muted-foreground"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="h-4 w-4" />
          New Folder
        </Button>
      )}

      <FolderDeleteDialog
        open={!!deleteFolder}
        onOpenChange={(open) => {
          if (!open) setDeleteFolder(null);
        }}
        folder={deleteFolder}
        onDeleted={(deletedId) => {
          if (activeFolder === deletedId) setActiveFolder(null);
        }}
      />
    </aside>
  );
}
