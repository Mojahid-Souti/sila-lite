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
import { type BuiltinTemplateOut, api } from "@/lib/api";
import { OKR_TEMPLATE_ID } from "@/lib/constants";
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Gauge,
  Globe,
  LayoutDashboard,
  type LucideIcon,
  Mail,
  MessageSquare,
  Presentation,
  Sheet,
  Sparkles,
  Table,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * "/" → Use a template — the Bazaar's visual language inside the chat: story-
 * ring avatars on clean cards, and an Instagram-profile-style DETAIL view on
 * click (big ring, what it takes, what it delivers, one Use button). Picking
 * pins the composer chip; the socket reconnects with the persona, exactly
 * like arriving from the Bazaar.
 */

const OUTPUTS: Record<string, { icon: LucideIcon; label: string }> = {
  dashboard: { icon: LayoutDashboard, label: "Dashboard" },
  slides: { icon: Presentation, label: "Slides" },
  powerbi: { icon: BarChart3, label: "Power BI" },
  grafana: { icon: Gauge, label: "Grafana" },
  word: { icon: FileText, label: "Word document" },
};

const SOURCES: Record<string, { icon: LucideIcon; label: string }> = {
  excel: { icon: Sheet, label: "Excel workbook" },
  csv: { icon: Table, label: "CSV file" },
  "google-sheets": { icon: Sheet, label: "Google Sheets" },
  "outlook-mail": { icon: Mail, label: "Outlook mail" },
  "ms-teams": { icon: MessageSquare, label: "Teams" },
  web: { icon: Globe, label: "Web" },
  transcript: { icon: FileText, label: "Meeting transcript" },
};

function IconStack({ keys }: { keys: string[] }) {
  return (
    <span className="-space-x-2 flex shrink-0">
      {keys.map((key) => {
        const meta = OUTPUTS[key];
        if (!meta) return null;
        const Icon = meta.icon;
        return (
          <span
            key={key}
            title={meta.label}
            className="grid size-7 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 ring-2 ring-white"
          >
            <Icon className="size-3.5" />
          </span>
        );
      })}
    </span>
  );
}

function TemplateDetail({
  template,
  skills,
  onSkillsChange,
  onBack,
  onUse,
}: {
  template: BuiltinTemplateOut;
  skills: PickedSkill[];
  onSkillsChange: (skills: PickedSkill[]) => void;
  onBack: () => void;
  onUse: () => void;
}) {
  const t = useTranslations("bazaar.skills");
  const okr = template.id === OKR_TEMPLATE_ID;
  return (
    <div className="flex min-w-0 flex-col items-center px-1 pb-1 text-center">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to templates"
        className="absolute top-4 left-4 grid size-8 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
      >
        <ArrowLeft className="size-4" />
      </button>
      <StoryRing name={template.name} size="size-20" text="text-2xl" animated />
      <h3 className="mt-3 font-semibold text-[17px] text-neutral-900">{template.name}</h3>
      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-neutral-500">
        <Sparkles className="size-3 text-primary" />
        Template · by Sila
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">{template.description}</p>

      <div className="mt-4 w-full space-y-3 text-left">
        <div>
          <p className="mb-1.5 font-medium text-[11px] text-neutral-400 uppercase tracking-wide">
            Takes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {template.sources.map((key) => {
              const meta = SOURCES[key];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[12px] text-neutral-600"
                >
                  <Icon className="size-3.5 text-neutral-400" />
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-1.5 font-medium text-[11px] text-neutral-400 uppercase tracking-wide">
            Delivers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {template.outputs.map((key) => {
              const meta = OUTPUTS[key];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[12px] text-primary"
                >
                  <Icon className="size-3.5" />
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pick skills to go with it — template and skills chosen together. */}
      <div className="mt-4 w-full text-left">
        <SkillMultiSelect
          selected={okr ? [] : skills}
          onChange={onSkillsChange}
          blockedReason={okr ? t("select.okr") : undefined}
        />
      </div>

      <button
        type="button"
        onClick={onUse}
        className="mt-5 w-full rounded-xl bg-primary py-2.5 font-medium text-[13.5px] text-primary-foreground transition-opacity hover:opacity-90"
      >
        {!okr && skills.length
          ? t("select.useWith", { count: skills.length })
          : t("select.useTemplate")}
      </button>
    </div>
  );
}

export function TemplatePickerModal({
  open,
  onOpenChange,
  token,
  activeId,
  attachedSkills = [],
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  activeId?: string;
  /** The chat's current skills — preselected, so the pick is the whole set. */
  attachedSkills?: PickedSkill[];
  onPick: (t: BuiltinTemplateOut, skills: PickedSkill[]) => void;
}) {
  const [templates, setTemplates] = useState<BuiltinTemplateOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<BuiltinTemplateOut | null>(null);
  const [skills, setSkills] = useState<PickedSkill[]>([]);
  const openDetail = (template: BuiltinTemplateOut) => {
    setSkills(attachedSkills);
    setDetail(template);
  };

  useEffect(() => {
    if (!open) {
      setDetail(null); // reopening always starts at the list
      return;
    }
    if (!token || templates.length > 0) return;
    let cancelled = false;
    setLoading(true);
    api.bazaar
      .templates(token)
      .then((list) => {
        if (!cancelled) setTemplates(list);
      })
      .catch(() => {
        /* the Bazaar page remains the fallback */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token, templates.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        {detail ? (
          <TemplateDetail
            template={detail}
            skills={skills}
            onSkillsChange={setSkills}
            onBack={() => setDetail(null)}
            onUse={() => {
              onPick(detail, detail.id === OKR_TEMPLATE_ID ? [] : skills);
              onOpenChange(false);
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Use a template
              </DialogTitle>
              <DialogDescription>
                Ready-to-use agents by Sila — tap one to see the details.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              {loading && (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-neutral-100" />
                  ))}
                </div>
              )}
              {!loading && templates.length === 0 && (
                <p className="py-6 text-center text-[13px] text-neutral-500">
                  No templates available right now — check the Bazaar.
                </p>
              )}
              {templates.map((t) => {
                const active = t.id === activeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openDetail(t)}
                    className={`flex items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-neutral-200 hover:border-primary/50 hover:bg-neutral-50"
                    }`}
                  >
                    <StoryRing name={t.name} size="size-11" text="text-sm" ring="p-[2px]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-semibold text-[13.5px] text-neutral-900">
                          {t.name}
                        </span>
                        {active && (
                          <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-[10px] text-primary uppercase">
                            Active
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-[12px] text-neutral-500">
                        {t.chip_hint}
                      </span>
                    </span>
                    <IconStack keys={t.outputs.slice(0, 4)} />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
