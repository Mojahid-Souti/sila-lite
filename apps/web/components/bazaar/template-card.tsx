"use client";

import { StoryRing } from "@/components/bazaar/story-ring";
import { OUTPUT_META, TemplateDetailsDialog } from "@/components/bazaar/template-details-dialog";
import type { BuiltinTemplateOut } from "@/lib/api";
import { templateChatHref } from "@/lib/chat-links";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * A built-in template's catalog card — same feed anatomy as BazaarAgentCard
 * (ringed avatar header / cover / action / caption) but for a VIRTUAL listing:
 * no likes/reviews/hire; one primary "Use template" action that opens the SILA
 * chat with the template pinned (`/dashboard?template=<id>`).
 */

export function TemplateCard({ template }: { template: BuiltinTemplateOut }) {
  const t = useTranslations("bazaar.templates");
  const router = useRouter();
  const open = (skillIds: string[] = []) => router.push(templateChatHref(template.id, skillIds));
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="relative flex flex-col rounded-xl border border-neutral-200 bg-white p-3.5 transition-shadow hover:shadow-md">
      {/* The card opens the details modal; "Use template" sits above it (z-10)
          so the two actions stay distinct — read about it, or start with it. */}
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        aria-label={`About ${template.name}`}
        className="absolute inset-0 rounded-xl"
      />
      <TemplateDetailsDialog
        template={template}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onUse={open}
      />
      {/* Header — ringed avatar + name, "Template · by <publisher>" subline */}
      <div className="flex items-center gap-2.5">
        <StoryRing name={template.name} size="size-8" text="text-[11px]" ring="p-[1.5px]" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[14px] text-neutral-900 leading-tight">
            {template.name}
          </h3>
          {/* The publisher, not a hardcoded "by Sila": these two were built for
              Omantel, and attributing them to the platform took the credit. */}
          <p className="flex items-center gap-1 text-[11px] text-neutral-500">
            <Sparkles className="size-3 shrink-0 text-primary" />
            {/* One line: a publisher name longer than "Sila" wrapped the subline
                and pushed the card header out of step with its neighbour. */}
            <span className="truncate">{t("byPublisher", { publisher: template.publisher })}</span>
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-[10.5px] text-primary uppercase tracking-wide">
          {t("badge")}
        </span>
      </div>

      {/* Cover — the outputs this template can deliver */}
      <div className="mt-3 grid h-28 place-items-center overflow-hidden rounded-lg border border-neutral-100 bg-gradient-to-br from-primary/[0.05] via-white to-primary/[0.03]">
        <div className="flex flex-col items-center gap-2">
          <span className="-space-x-2.5 flex">
            {template.outputs.map((o) => {
              const meta = OUTPUT_META[o];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <span
                  key={o}
                  title={meta.label}
                  className="grid size-10 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm ring-2 ring-white"
                >
                  <Icon className="size-[18px]" />
                </span>
              );
            })}
          </span>
          <p className="max-w-[16rem] truncate text-[11px] text-neutral-500">
            {template.chip_hint}
          </p>
        </div>
      </div>

      {/* Action */}
      <button
        type="button"
        onClick={() => open()}
        className="relative z-10 mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary font-medium text-sm text-white transition-colors hover:bg-primary/90"
      >
        <Sparkles className="size-4" />
        {t("useButton")}
      </button>

      {/* Caption */}
      <p className="mt-2 line-clamp-2 text-[12.5px] text-neutral-600 leading-relaxed">
        {template.description}
      </p>
    </div>
  );
}
