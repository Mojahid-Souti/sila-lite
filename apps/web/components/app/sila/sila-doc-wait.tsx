"use client";

import { cn } from "@/lib/utils";
import { Loader2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

/**
 * The docs-wait bar — replaces the old upload pop-up. It docks above the composer
 * while the build waits for documents: the user drops files anywhere in the chat
 * (or browses from here) and the flow continues by itself. No modal, no blocking;
 * the pause is durable, so SILA waits quietly for as long as it takes.
 */
export function SilaDocWait({
  prompt,
  busy,
  error,
  onFiles,
  onSkip,
}: {
  prompt?: string;
  busy: boolean;
  error?: string;
  onFiles: (files: File[]) => void;
  onSkip: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "rounded-2xl border-2 border-dashed bg-white/95 px-4 py-3 shadow-sm backdrop-blur transition-colors",
        dragging ? "border-neutral-900 bg-neutral-50" : "border-neutral-300"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        {busy ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-neutral-500" />
        ) : (
          <UploadCloud className="size-5 shrink-0 text-neutral-400" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-neutral-800">
            {busy ? "Uploading your documents…" : "Waiting for your documents"}
          </p>
          <p className="truncate text-[12px] text-neutral-500">
            {error ||
              prompt ||
              "Drop them anywhere in the chat, or browse — I'll continue the moment they arrive."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-8 shrink-0 items-center rounded-lg border border-neutral-300 bg-white px-3 font-medium text-[13px] text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-40"
        >
          Browse
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          className="shrink-0 text-[12px] text-neutral-400 underline-offset-2 transition-colors hover:text-neutral-600 hover:underline disabled:opacity-40"
        >
          Continue without documents
        </button>
      </div>
    </div>
  );
}
