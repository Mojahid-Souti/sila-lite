"use client";

import { CATEGORY_ICON } from "@/components/bazaar/skill-card";
import { type SkillOut, api } from "@/lib/api";
import { MAX_CHAT_SKILLS } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, Puzzle, ScrollText, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Rows shown before "Show more". */
const FIRST_ROWS = 5;
/** How many published skills the selector searches over (one request). */
const FETCH_SIZE = 100;

/** What the selector needs of a skill — the chat's chips carry just this. */
export type PickedSkill = Pick<SkillOut, "id" | "name">;

/**
 * Pick skills to go with a template — the one place both are chosen together
 * (the chat's "/ → Use a template" and the Bazaar's template details). Checkbox
 * rows, a search, the first few with "Show more", at most MAX_CHAT_SKILLS.
 * `blockedReason` replaces the list (the OKR Reporting Pack carries no skills).
 */
export function SkillMultiSelect({
  selected,
  onChange,
  blockedReason,
}: {
  selected: PickedSkill[];
  onChange: (skills: PickedSkill[]) => void;
  blockedReason?: string;
}) {
  const t = useTranslations("bazaar.skills");
  const token = useToken();
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["bazaar-skills", { q, page: 1, size: FETCH_SIZE, select: true }],
    queryFn: () => api.skills.list(token, { q, page: 1, size: FETCH_SIZE }),
    enabled: !!token && !blockedReason,
    placeholderData: keepPreviousData,
  });

  if (blockedReason) {
    return (
      <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-[12px] text-neutral-500">
        {blockedReason}
      </p>
    );
  }

  const skills = data?.items ?? [];
  const shown = expanded ? skills : skills.slice(0, FIRST_ROWS);
  const chosen = new Set(selected.map((s) => s.id));
  const full = selected.length >= MAX_CHAT_SKILLS;
  const toggle = (skill: SkillOut) =>
    onChange(
      chosen.has(skill.id) ? selected.filter((s) => s.id !== skill.id) : [...selected, skill]
    );

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-medium text-[11px] text-neutral-400 uppercase tracking-wide">
          <ScrollText className="size-3.5 text-emerald-600" />
          {t("select.title")}
        </p>
        <span className="text-[11px] text-neutral-400">
          {t("select.count", { count: selected.length, max: MAX_CHAT_SKILLS })}
        </span>
      </div>
      <label className="relative block">
        <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-3.5 text-neutral-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("select.search")}
          className="h-8 w-full rounded-lg border border-neutral-200 bg-white pr-2 pl-8 text-[12.5px] outline-none focus:border-primary/50"
        />
      </label>
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {isLoading && <li className="px-3 py-3 text-[12px] text-neutral-400">…</li>}
        {!isLoading && skills.length === 0 && (
          <li className="px-3 py-3 text-[12px] text-neutral-500">{t("select.none")}</li>
        )}
        {shown.map((skill) => {
          const on = chosen.has(skill.id);
          const Icon = CATEGORY_ICON[skill.category] ?? Puzzle;
          return (
            <li key={skill.id}>
              <label
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${
                  !on && full
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-neutral-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && full}
                  onChange={() => toggle(skill)}
                  className="peer sr-only"
                />
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 ${
                    on ? "border-primary bg-primary text-white" : "border-neutral-300 bg-white"
                  }`}
                >
                  {on && <Check className="size-3" />}
                </span>
                <Icon className="size-3.5 shrink-0 text-neutral-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[12.5px] text-neutral-900">
                    {skill.name}
                  </span>
                  <span className="block truncate text-[11px] text-neutral-500">
                    {skill.description}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {skills.length > FIRST_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-medium text-[12px] text-primary hover:underline"
        >
          {expanded ? t("showLess") : t("showMoreCount", { count: skills.length - FIRST_ROWS })}
        </button>
      )}
    </div>
  );
}
