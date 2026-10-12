"use client";

import { SearchBar } from "@/components/bazaar/search-bar";
import { CATEGORY_ICON } from "@/components/bazaar/skill-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { type SkillOut, api } from "@/lib/api";
import { useToken } from "@/lib/use-token";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, Puzzle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * "/" → Add a skill: the Bazaar's published skills, searchable, one click to
 * attach. Only published (reviewed) skills are listed — the API serves no other.
 */
export function SkillPicker({
  open,
  onOpenChange,
  attachedIds,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attachedIds: string[];
  onPick: (skill: SkillOut) => void;
}) {
  const t = useTranslations("sila.skills");
  const tb = useTranslations("bazaar.skills");
  const token = useToken();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["bazaar-skills", { q, page: 1, size: 20, picker: true }],
    queryFn: () => api.skills.list(token, { q, page: 1, size: 20 }),
    enabled: open && !!token,
    placeholderData: keepPreviousData,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 space-y-3 border-neutral-100 border-b px-5 py-4">
          <DialogTitle>{t("pickerTitle")}</DialogTitle>
          <DialogDescription className="sr-only">{t("pickerSearch")}</DialogDescription>
          <SearchBar value={q} onChange={setQ} placeholder={t("pickerSearch")} />
        </DialogHeader>
        <ul className="min-h-0 flex-1 divide-y divide-neutral-100 overflow-y-auto">
          {isLoading &&
            [0, 1, 2].map((i) => (
              <li key={i} className="space-y-2 px-5 py-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </li>
            ))}
          {!isLoading && data?.items.length === 0 && (
            <li className="px-5 py-6 text-center text-neutral-500 text-sm">{t("pickerEmpty")}</li>
          )}
          {data?.items.map((skill) => {
            const attached = attachedIds.includes(skill.id);
            const Icon = CATEGORY_ICON[skill.category] ?? Puzzle;
            return (
              <li key={skill.id}>
                <button
                  type="button"
                  disabled={attached}
                  onClick={() => onPick(skill)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-neutral-50 disabled:opacity-60"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-neutral-900 text-sm">
                      {skill.name}
                    </span>
                    <span className="block truncate text-[11.5px] text-neutral-500">
                      {tb(`categories.${skill.category}` as "categories.other")} · {skill.source}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[12.5px] text-neutral-600">
                      {skill.description}
                    </span>
                  </span>
                  {attached && <Check className="mt-1 size-4 shrink-0 text-emerald-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
