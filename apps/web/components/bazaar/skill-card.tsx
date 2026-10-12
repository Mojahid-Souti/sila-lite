"use client";

import { SkillDetailsDialog } from "@/components/bazaar/skill-details-dialog";
import { StoryRing } from "@/components/bazaar/story-ring";
import type { SkillOut } from "@/lib/api";
import { skillChatHref } from "@/lib/chat-links";
import {
  BarChart3,
  Code2,
  FileCode2,
  Image,
  ListChecks,
  type LucideIcon,
  Megaphone,
  Palette,
  PenLine,
  Puzzle,
  ScrollText,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** The icon for a skill category key (see the API's skills.categories). */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  development: Code2,
  data: BarChart3,
  design: Palette,
  writing: PenLine,
  marketing: Megaphone,
  media: Image,
  productivity: ListChecks,
  other: Puzzle,
};

/**
 * An open-source skill's catalog card — the template card's anatomy (ringed
 * avatar header / cover / action / caption). The card opens the details
 * dialog; "Use skill" opens the chat with the skill attached to the composer.
 */
export function SkillCard({ skill }: { skill: SkillOut }) {
  const t = useTranslations("bazaar.skills");
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const use = () => router.push(skillChatHref(skill.id));
  const Icon = CATEGORY_ICON[skill.category] ?? Puzzle;

  return (
    <div className="relative flex flex-col rounded-xl border border-neutral-200 bg-white p-3.5 transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        aria-label={t("about", { name: skill.name })}
        className="absolute inset-0 rounded-xl"
      />
      <SkillDetailsDialog
        skillId={skill.id}
        summary={skill}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onUse={use}
      />
      <div className="flex items-center gap-2.5">
        <StoryRing name={skill.name} size="size-8" text="text-[11px]" ring="p-[1.5px]" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[14px] text-neutral-900 leading-tight">
            {skill.name}
          </h3>
          <p className="flex items-center gap-1 text-[11px] text-neutral-500">
            <ScrollText className="size-3 shrink-0 text-primary" />
            <span className="truncate">{t("fromSource", { source: skill.source })}</span>
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-[10.5px] text-emerald-700 uppercase tracking-wide">
          {t("badge")}
        </span>
      </div>

      <div className="mt-3 grid h-28 place-items-center overflow-hidden rounded-lg border border-neutral-100 bg-gradient-to-br from-emerald-50/60 via-white to-primary/[0.03]">
        <div className="flex flex-col items-center gap-2 px-2 text-center">
          <span className="grid size-10 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm">
            <Icon className="size-[18px]" />
          </span>
          <span className="text-[11px] text-neutral-500">
            {t(`categories.${skill.category}` as "categories.other")} ·{" "}
            {t("installs", { count: skill.installs.toLocaleString() })}
          </span>
          <span className="flex max-w-full flex-nowrap justify-center gap-1">
            <SkillBadges skill={skill} />
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={use}
        className="relative z-10 mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary font-medium text-sm text-white transition-colors hover:bg-primary/90"
      >
        <ScrollText className="size-4" />
        {t("useSkill")}
      </button>
      <p className="mt-2.5 line-clamp-2 text-[13px] text-neutral-600 leading-snug">
        {skill.description}
      </p>
    </div>
  );
}

/** Licence and scripts, as small badges — shared by the card and the dialog. */
export function SkillBadges({ skill }: { skill: Pick<SkillOut, "license" | "has_scripts"> }) {
  const t = useTranslations("bazaar.skills");
  return (
    <>
      <span
        title={skill.license ?? undefined}
        className={`inline-block min-w-0 max-w-[6.5rem] truncate rounded-md px-1.5 py-0.5 text-[10.5px] ${
          skill.license ? "bg-neutral-100 text-neutral-600" : "bg-amber-50 text-amber-700"
        }`}
      >
        {skill.license ? t("licence", { licence: skill.license }) : t("noLicence")}
      </span>
      <span
        title={skill.has_scripts ? t("scriptsNotRun") : undefined}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10.5px] text-neutral-600"
      >
        <FileCode2 className="size-3" />
        {skill.has_scripts ? t("scriptsBadge") : t("instructionsOnly")}
      </span>
    </>
  );
}
