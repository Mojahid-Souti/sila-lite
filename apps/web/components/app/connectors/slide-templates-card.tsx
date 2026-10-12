"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Presentation, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Corporate slide templates — an admin uploads the branded .pptx once; SILA
 * fills it with generated slides on demand ("make me slides on the Omantel
 * template"). The deck inherits the template's masters/layouts/theme — logos,
 * fonts, colors come free.
 */
export function SlideTemplatesCard({ workspaceId }: { workspaceId: string }) {
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");

  const { data: allTemplates } = useQuery({
    queryKey: ["pptx-templates", workspaceId],
    queryFn: () => api.connectors.listPptxTemplates(workspaceId, token),
    enabled: !!token,
  });
  // Built-ins ship with the platform — nothing to manage here.
  const templates = allTemplates?.filter((t) => !t.builtin);

  const upload = useMutation({
    mutationFn: (file: File) =>
      api.connectors.uploadPptxTemplate(workspaceId, name.trim() || file.name, file, token),
    onSuccess: () => {
      toast("Template uploaded", "success");
      setName("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["pptx-templates", workspaceId] });
    },
    onError: (e: Error) => toast(e.message || "Couldn't upload the template", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.connectors.deletePptxTemplate(workspaceId, id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pptx-templates", workspaceId] }),
    onError: (e: Error) => toast(e.message || "Couldn't delete", "error"),
  });

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg border border-neutral-200 bg-white text-violet-600">
          <Presentation className="size-4.5" />
        </div>
        <div>
          <p className="font-medium text-neutral-900 text-sm">Slide templates</p>
          <p className="text-[12.5px] text-neutral-500">
            Upload your corporate .pptx once — SILA builds decks on it ("make me slides on the
            Omantel template").
          </p>
        </div>
      </div>

      {(templates?.length ?? 0) > 0 && (
        <ul className="mt-3 space-y-1.5">
          {templates?.map((t) => (
            <li
              key={t.id}
              className="group flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50/60 px-2 py-1.5"
            >
              {t.thumbnails?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.thumbnails[0]}
                  alt=""
                  className="h-9 w-16 shrink-0 rounded border border-neutral-200 object-cover"
                />
              ) : (
                <span className="grid h-9 w-16 shrink-0 place-items-center rounded border border-neutral-200 bg-white">
                  <Presentation className="size-4 text-neutral-300" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate font-medium text-[13px] text-neutral-800">
                {t.name}
              </span>
              <span className="mr-1 shrink-0 text-[11.5px] text-neutral-400">
                {(t.file_size / 1_048_576).toFixed(1)} MB
              </span>
              <button
                type="button"
                aria-label={`Delete ${t.name}`}
                onClick={() => remove.mutate(t.id)}
                className="grid size-6 shrink-0 place-items-center rounded-md text-neutral-400 opacity-0 transition hover:bg-neutral-200 hover:text-red-600 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (e.g. Omantel)"
          className="h-9 max-w-56"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".pptx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {upload.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Upload .pptx
        </Button>
      </div>
    </div>
  );
}
