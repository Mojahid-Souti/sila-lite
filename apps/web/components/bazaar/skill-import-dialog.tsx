"use client";

import { SearchBar } from "@/components/bazaar/search-bar";
import { SkillBadges } from "@/components/bazaar/skill-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { type CatalogSkillOut, api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * The workspace Admin's importer: search the upstream open-source catalog and
 * import a skill. The server fetches only its SKILL.md, scans it, and leaves it
 * waiting for a Reviewer — nothing appears in the Bazaar from here.
 */
export function SkillImportDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("bazaar.skills");
  const token = useToken();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [ref, setRef] = useState("");

  // "Show more" through the catalog, 20 at a time.
  const { data, isLoading, isError, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["skill-catalog", workspaceId, q],
      queryFn: ({ pageParam }) => api.skills.catalog(workspaceId, token, q, pageParam),
      initialPageParam: 1,
      getNextPageParam: (last) => (last.page * last.size < last.total ? last.page + 1 : undefined),
      enabled: open && !!token && !!workspaceId,
      placeholderData: keepPreviousData,
      staleTime: 60_000,
    });
  const entries = data?.pages.flatMap((p) => p.items) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const importSkill = useMutation({
    mutationFn: (entry: Pick<CatalogSkillOut, "source" | "skill_key">) =>
      api.skills.importSkill(workspaceId, entry.source, entry.skill_key, token),
    onSuccess: (skill) => {
      toast(
        skill.vetting_status === "rejected"
          ? t("import.rejected", { name: skill.name })
          : t("import.done", { name: skill.name }),
        skill.vetting_status === "rejected" ? "error" : "success"
      );
      for (const key of ["skill-catalog", "workspace-skills", "bazaar-skills", "notifications"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (err: Error) => toast(t("import.failed", { error: err.message }), "error"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-3 border-neutral-100 border-b px-5 py-4 sm:px-6">
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>{t("import.subtitle")}</DialogDescription>
          <SearchBar value={q} onChange={setQ} placeholder={t("import.search")} />
          <ImportByReference
            value={ref}
            onChange={setRef}
            busy={importSkill.isPending}
            onImport={(source, skillKey) => importSkill.mutate({ source, skill_key: skillKey })}
          />
        </DialogHeader>
        <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
          {isLoading &&
            [0, 1, 2].map((i) => (
              <li key={i} className="space-y-2 px-5 py-3 sm:px-6">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </li>
            ))}
          {isError && (
            <li className="px-5 py-6 text-center text-red-600 text-sm sm:px-6">
              {t("import.failed", { error: (error as Error).message })}
            </li>
          )}
          {data && entries.length === 0 && (
            <li className="px-5 py-6 text-center text-neutral-500 text-sm sm:px-6">
              {t("import.empty")}
            </li>
          )}
          {entries.map((entry) => {
            const busy =
              importSkill.isPending &&
              importSkill.variables?.source === entry.source &&
              importSkill.variables?.skill_key === entry.skill_key;
            return (
              <li
                key={`${entry.source}/${entry.skill_key}`}
                className="flex items-start gap-3 px-5 py-3 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900 text-sm">{entry.name}</p>
                  <p className="truncate text-[11.5px] text-neutral-500">
                    {entry.source} · {t("installs", { count: entry.installs.toLocaleString() })}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12.5px] text-neutral-600">
                    {entry.description}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <SkillBadges skill={entry} />
                  </div>
                </div>
                {entry.imported ? (
                  <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-neutral-100 px-2.5 text-neutral-600 text-xs">
                    <Check className="size-3.5" />
                    {entry.imported_status ? t(`status.${entry.imported_status}`) : ""}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={importSkill.isPending}
                    onClick={() => importSkill.mutate(entry)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 font-medium text-white text-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    {busy ? t("import.importing") : t("import.action")}
                  </button>
                )}
              </li>
            );
          })}
          {hasNextPage && (
            <li className="flex justify-center px-5 py-3">
              <button
                type="button"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 font-medium text-neutral-700 text-xs hover:bg-neutral-50 disabled:opacity-50"
              >
                {isFetchingNextPage && <Loader2 className="size-3.5 animate-spin" />}
                {t("showMoreCount", { count: total - entries.length })}
              </button>
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

/** owner/repo/skill-folder — the same allow-listed fetch, parse and scan. */
const REFERENCE = /^([\w.-]+\/[\w.-]+)\/([\w.:-]+)$/;

/** Import a skill the catalog snapshot doesn't list, by its GitHub reference. */
function ImportByReference({
  value,
  onChange,
  busy,
  onImport,
}: {
  value: string;
  onChange: (v: string) => void;
  busy: boolean;
  onImport: (source: string, skillKey: string) => void;
}) {
  const t = useTranslations("bazaar.skills");
  const match = REFERENCE.exec(value.trim());
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (match) onImport(match[1], match[2]);
      }}
    >
      <p className="font-medium text-[11px] text-neutral-500">{t("import.byRef")}</p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("import.byRefPlaceholder")}
          aria-invalid={value.trim() !== "" && !match}
          className="h-8 min-w-0 flex-1 rounded-lg border border-neutral-200 px-2.5 font-mono text-[12px] outline-none focus:border-primary/50 aria-[invalid=true]:border-red-300"
        />
        <button
          type="submit"
          disabled={!match || busy}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 font-medium text-white text-xs hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="size-3.5" />
          {t("import.action")}
        </button>
      </div>
      <p className="text-[11px] text-neutral-400">
        {value.trim() !== "" && !match ? t("import.byRefInvalid") : t("import.byRefHint")}
      </p>
    </form>
  );
}
