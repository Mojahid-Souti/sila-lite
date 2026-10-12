"use client";

import { SkillBadges } from "@/components/bazaar/skill-card";
import { StoryRing } from "@/components/bazaar/story-ring";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { type SkillOut, api } from "@/lib/api";
import { SimpleMarkdown } from "@/lib/simple-markdown";
import { useToken } from "@/lib/use-token";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * A skill's details: what it is, where it comes from, what it declares it
 * needs, and its instructions — the exact text a chat would carry. The text is
 * third-party markdown, rendered by SimpleMarkdown (no raw HTML; only http,
 * https and mailto links). Fetched when opened, so the grid stays light.
 */
export function SkillDetailsDialog({
  skillId,
  summary,
  open,
  onOpenChange,
  onUse,
  workspaceId,
}: {
  skillId: string;
  summary?: SkillOut;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse?: () => void;
  /** Lets a member of the importing workspace see a draft. */
  workspaceId?: string;
}) {
  const t = useTranslations("bazaar.skills");
  const token = useToken();
  const { data: full, isLoading } = useQuery({
    queryKey: ["skill", skillId, workspaceId ?? ""],
    queryFn: () => api.skills.get(skillId, token, workspaceId),
    enabled: open && !!token,
    staleTime: 5 * 60_000,
  });
  const skill = full ?? summary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-neutral-100 border-b px-5 py-4 pr-14 sm:px-6">
          <DialogTitle className="flex min-w-0 items-center gap-3 text-lg">
            <StoryRing name={skill?.name ?? "?"} size="size-9" text="text-xs" ring="p-[1.5px]" />
            <span className="min-w-0 flex-1 truncate">{skill?.name}</span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-[10.5px] text-emerald-700 uppercase tracking-wide">
              {t("badge")}
            </span>
            {skill && (
              <>
                <span className="text-[11.5px] text-neutral-500">
                  {t(`categories.${skill.category}` as "categories.other")} ·{" "}
                  {t("installs", { count: skill.installs.toLocaleString() })}
                </span>
                <SkillBadges skill={skill} />
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
          {skill && (
            <p className="text-[13.5px] text-neutral-700 leading-relaxed">{skill.description}</p>
          )}
          {skill && (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="font-medium text-[10.5px] text-neutral-400 uppercase tracking-wider">
                  {t("details.source")}
                </dt>
                <dd className="mt-1 text-[13px]">
                  <a
                    href={skill.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {skill.source}
                    <ExternalLink className="size-3" />
                  </a>
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-medium text-[10.5px] text-neutral-400 uppercase tracking-wider">
                  {t("details.dependencies")}
                </dt>
                <dd className="mt-1 text-[13px] text-neutral-800">
                  {skill.dependencies.length
                    ? skill.dependencies.map((d) => `${d.name} (${d.type})`).join(", ")
                    : t("details.none")}
                </dd>
              </div>
            </dl>
          )}
          <section>
            <h3 className="mb-2 font-medium text-[10.5px] text-neutral-400 uppercase tracking-wider">
              {t("details.instructions")}
            </h3>
            {isLoading && !full ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div className="max-w-none rounded-lg border border-neutral-100 bg-neutral-50/60 p-4 text-[13px] text-neutral-800">
                <SimpleMarkdown text={full?.instructions ?? ""} />
              </div>
            )}
          </section>
        </div>

        {/* A plain footer: the primitive's negative margins are clipped here. */}
        <div className="flex shrink-0 justify-end gap-2 border-neutral-100 border-t px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center rounded-lg border border-neutral-200 px-4 font-medium text-neutral-700 text-sm hover:bg-neutral-50"
          >
            {t("details.close")}
          </button>
          {onUse && skill?.published && (
            <button
              type="button"
              onClick={onUse}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 font-medium text-sm text-white hover:bg-primary/90"
            >
              <ScrollText className="size-4" />
              {t("useSkill")}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
