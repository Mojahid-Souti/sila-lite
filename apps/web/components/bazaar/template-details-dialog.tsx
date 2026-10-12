"use client";

import { type PickedSkill, SkillMultiSelect } from "@/components/bazaar/skill-multi-select";
import { StoryRing } from "@/components/bazaar/story-ring";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BuiltinTemplateOut } from "@/lib/api";
import { ConnectorIcon } from "@/lib/connector-icons";
import { OKR_TEMPLATE_ID } from "@/lib/constants";
import { SOVEREIGNTY_NOTE } from "@/lib/describe-agent";
import { publisherBrand } from "@/lib/publishers";
import {
  ArrowRight,
  BarChart3,
  FileText,
  Gauge,
  Globe,
  LayoutDashboard,
  type LucideIcon,
  MessageSquareText,
  PencilLine,
  Presentation,
  Sheet,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * What a Bazaar template IS, as a centered modal.
 *
 * The card could only be USED — one button that pins the template and drops you
 * into a chat. Anyone weighing two templates had a truncated sentence and four
 * unlabelled glyphs to go on. This is the page that answers "what does this read,
 * what does it give me back, and who made it" before a decision, with the same
 * anatomy as the agent details modal so the two read as one family.
 */

/** What a template can produce. Shared with the card's cover row. */
export const OUTPUT_META: Record<string, { icon: LucideIcon; label: string; note: string }> = {
  dashboard: {
    icon: LayoutDashboard,
    label: "Dashboard",
    note: "Charts and figures rendered in the chat",
  },
  slides: { icon: Presentation, label: "Slide deck", note: "PowerPoint, on your own template" },
  powerbi: { icon: BarChart3, label: "Power BI", note: "Pushed to your workspace" },
  grafana: { icon: Gauge, label: "Grafana", note: "A live board on your Grafana" },
  word: { icon: FileText, label: "Word document", note: "A styled .docx you can sign off" },
};

/** What a template can read FROM. Connector names fall through to their own
 *  brand marks; the rest are platform concepts with no logo to show. */
const SOURCE_META: Record<string, { label: string; icon?: LucideIcon }> = {
  excel: { label: "Excel workbook", icon: Sheet },
  csv: { label: "CSV file", icon: Sheet },
  web: { label: "The web", icon: Globe },
  transcript: { label: "Meeting transcript", icon: MessageSquareText },
  // Not every template starts from a system. SmartQuote and the permit pack
  // are typed in, and saying so beats a generic plug icon implying a connector.
  manual: { label: "Entered in the chat", icon: PencilLine },
};

function sourceLabel(name: string): string {
  return (
    SOURCE_META[name]?.label ??
    name
      .replace(/^ms-/, "")
      .replace(/^google-/, "Google ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-medium text-[10.5px] text-neutral-400 uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-1 text-[13px] text-neutral-900 leading-snug">{children}</dd>
    </div>
  );
}

export function TemplateDetailsDialog({
  template,
  open,
  onOpenChange,
  onUse,
}: {
  template: BuiltinTemplateOut;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Start the chat with this template and the skills picked here. */
  onUse: (skillIds: string[]) => void;
}) {
  const t = useTranslations("bazaar.skills");
  const brand = publisherBrand(template.publisher);
  const [skills, setSkills] = useState<PickedSkill[]>([]);
  // The chip hint is already a pipeline — "CSV · Sheets · web → dashboard /
  // slides". Split on the arrow so each half sits under its own heading rather
  // than as one line the reader has to parse.
  const [readsHint, producesHint] = template.chip_hint.split("→").map((s) => s.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-neutral-100 border-b px-5 py-4 pr-14 sm:px-6">
          <DialogTitle className="flex min-w-0 items-center gap-3 text-lg">
            <StoryRing name={template.name} size="size-9" text="text-[12px]" ring="p-[1.5px]" />
            <span className="min-w-0 flex-1 truncate">{template.name}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-[10.5px] text-primary uppercase tracking-wide">
              Template
            </span>
            {/* The wordmark IS the publisher's name set in their own type, so
                the byline shows it in place of the words, never beside them. */}
            {brand ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-neutral-500">
                by <img src={brand.logo} alt={brand.alt} className="h-3.5 w-auto" />
              </span>
            ) : (
              <span className="text-[11.5px] text-neutral-500">by {template.publisher}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-[13.5px] text-neutral-700 leading-relaxed">{template.description}</p>

          {/* Reads → produces, the shape of the thing, side by side on a wide
              screen and stacked on a phone. */}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-3">
            <section className="min-w-0">
              <p className="mb-2 font-medium text-[10.5px] text-neutral-400 uppercase tracking-wider">
                Reads from
              </p>
              <ul className="space-y-1.5">
                {template.sources.map((s) => {
                  const known = SOURCE_META[s];
                  const Icon = known?.icon;
                  return (
                    <li
                      key={s}
                      className="flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5"
                    >
                      {Icon ? (
                        <Icon className="size-4 shrink-0 text-neutral-500" />
                      ) : (
                        <ConnectorIcon name={sourceLabel(s)} className="size-4 shrink-0" />
                      )}
                      <span className="min-w-0 truncate text-[12.5px] text-neutral-800">
                        {sourceLabel(s)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <span aria-hidden className="hidden self-center text-neutral-300 sm:block sm:pt-7">
              <ArrowRight className="size-4" />
            </span>

            <section className="min-w-0">
              <p className="mb-2 font-medium text-[10.5px] text-neutral-400 uppercase tracking-wider">
                Gives you back
              </p>
              <ul className="space-y-1.5">
                {template.outputs.map((o) => {
                  const meta = OUTPUT_META[o];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <li
                      key={o}
                      className="flex items-start gap-2 rounded-lg border border-neutral-200 px-2.5 py-1.5"
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] text-neutral-800">
                          {meta.label}
                        </span>
                        <span className="block text-[11px] text-neutral-500 leading-snug">
                          {meta.note}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Category">
              <span className="capitalize">{template.category_slug.replace(/-/g, " ")}</span>
            </Field>
            <Field label="Classification">
              <span className="capitalize">{template.classification}</span>
            </Field>
            <Field label="Runs as">A pinned chat session</Field>
          </dl>

          {readsHint && producesHint && (
            <Field label="In one line">
              <span className="text-neutral-600">
                {readsHint} <span className="text-neutral-400">→</span> {producesHint}
              </span>
            </Field>
          )}

          {template.tags.length > 0 && (
            <div>
              <p className="mb-2 font-medium text-[10.5px] text-neutral-400 uppercase tracking-wider">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {template.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] text-neutral-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <SkillMultiSelect
            selected={skills}
            onChange={setSkills}
            blockedReason={template.id === OKR_TEMPLATE_ID ? t("select.okr") : undefined}
          />

          <p className="flex gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-[12px] text-neutral-500 leading-relaxed">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
            {SOVEREIGNTY_NOTE}
          </p>
        </div>

        <div className="shrink-0 border-neutral-100 border-t px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => onUse(skills.map((s) => s.id))}
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-primary font-medium text-sm text-white transition-colors hover:bg-primary/90"
          >
            <Sparkles className="size-4" />
            {skills.length
              ? t("select.useWith", { count: skills.length })
              : t("select.useTemplate")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
