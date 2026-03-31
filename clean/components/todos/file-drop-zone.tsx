"use client";

import { useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { formatSize } from "@/hooks/use-todos";

interface FileDropZoneProps {
  files: File[];
  onChange: (files: File[]) => void;
}

export function FileDropZone({ files, onChange }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const arr = Array.from(newFiles);
      onChange([...files, ...arr]);
    },
    [files, onChange]
  );

  const removeFile = useCallback(
    (index: number) => {
      onChange(files.filter((_, i) => i !== index));
    },
    [files, onChange]
  );

  return (
    <div>
      <div
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-xs font-medium transition-all ${
          dragOver
            ? "scale-[1.01] border-primary bg-primary/5 text-primary"
            : "border-border text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        Click or drag files here (max 4 MB each)
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              <span className="max-w-[140px] truncate">{f.name}</span>
              <span className="text-muted-foreground">
                ({formatSize(f.size)})
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-0.5 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
