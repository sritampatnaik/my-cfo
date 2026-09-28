"use client";

import { useRef, useState } from "react";
import { noteDuplicate } from "@/lib/filenames";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PendingFile = {
  key: string;
  file: File;
  warning: string | null;
  process: boolean;
};

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function reviewFiles(files: File[], existingNames: string[]) {
  const names = [...existingNames];
  return files.map((file) => {
    const noted = noteDuplicate(file.name, names);
    names.push(file.name);
    return {
      key: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      warning: noted.warning,
      process: noted.warning === null,
    };
  });
}

export function UploadDialog({
  open,
  onOpenChange,
  existingNames,
  onProcess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: string[];
  onProcess: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState("");

  function reset() {
    setPending([]);
    setDragOver(false);
    setLocalError("");
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function addFiles(list: File[]) {
    const pdfs = list.filter(isPdf);
    const rejected = list.length - pdfs.length;
    setLocalError(rejected > 0 ? "Only PDF e-statements can be uploaded." : "");
    if (pdfs.length === 0) return;
    setPending((current) => {
      const seen = new Set(current.map((item) => item.key));
      const fresh = pdfs.filter((file) => !seen.has(`${file.name}-${file.size}-${file.lastModified}`));
      return reviewFiles(
        [...current.map((item) => item.file), ...fresh],
        existingNames,
      ).map((item) => {
        const previous = current.find((entry) => entry.key === item.key);
        return previous ? { ...item, process: previous.process } : item;
      });
    });
  }

  function setProcess(key: string, process: boolean) {
    setPending((current) => current.map((item) => (item.key === key ? { ...item, process } : item)));
  }

  const selected = pending.filter((item) => item.process);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload e-statements</DialogTitle>
          <DialogDescription>
            Drop PDF statements here, or choose files. Names that match an earlier upload are flagged before anything is processed.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            addFiles([...(event.dataTransfer.files ?? [])]);
          }}
          className={`rounded-lg border border-dashed px-4 py-8 text-center ${dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/40"}`}
        >
          <span className="block text-sm font-medium">Drag and drop PDFs here</span>
          <span className="mt-1 block text-sm text-muted-foreground">or click to choose files</span>
        </button>
        {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
        {pending.length > 0 ? (
          <ul className="max-h-64 space-y-2 overflow-auto">
            {pending.map((item) => (
              <li key={item.key} className="flex items-start gap-3 rounded-lg border px-3 py-2">
                <Checkbox
                  checked={item.process}
                  onCheckedChange={(value) => setProcess(item.key, value === true)}
                  aria-label={`Process ${item.file.name}`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  {item.warning ? (
                    <p className="text-sm text-amber-800">{item.warning}. Process it only if you still want this copy.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No earlier file with this name.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={selected.length === 0}
            onClick={() => {
              const files = selected.map((item) => item.file);
              close();
              onProcess(files);
            }}
          >
            Process {selected.length === 1 ? "1 file" : `${selected.length} files`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
