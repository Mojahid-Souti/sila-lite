"use client";

import { TOOL_LABELS } from "@/components/agent/agent-card";
import { StoryRing } from "@/components/bazaar/story-ring";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type BazaarAgentOut, api } from "@/lib/api";
import { ConnectorIcon } from "@/lib/connector-icons";
import { ROUTES } from "@/lib/constants";
import { formatSchedule } from "@/lib/schedule";
import { useQuery } from "@tanstack/react-query";
import { Clock, Heart, MessageSquare, Star, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

type Props = { workspaceId: string; token: string };

const MAX_STORIES = 8;

/**
 * Trending as Instagram-style stories (Mojahid's design): a row of
 * gradient-ringed monogram circles; the top pick wears a small TOP badge
 * (like IG's LIVE pill). Tapping one opens a story-style card with the
 * agent's pitch and a View-agent CTA. Most-liked first; renders nothing
 * when the Bazaar is empty.
 */
export function TrendingStrip({ workspaceId, token }: Props) {
  const t = useTranslations("bazaar");
  const [active, setActive] = useState<BazaarAgentOut | null>(null);

  // Stable, filter-independent source: the hero pick + the first catalog page,
  // deduped and ordered by likes. O(n log n), n ≤ 20.
  const { data: hero } = useQuery({
    queryKey: ["bazaar-trending", workspaceId],
    queryFn: () => api.bazaar.trending(workspaceId, token),
    enabled: !!token && !!workspaceId,
  });
  const { data: firstPage } = useQuery({
    queryKey: ["bazaar-trending-strip", workspaceId],
    queryFn: () => api.bazaar.list(workspaceId, token, { q: "", cat: [], page: 1, size: 20 }),
    enabled: !!token && !!workspaceId,
  });

  const seen = new Set<string>();
  const stories: BazaarAgentOut[] = [];
  const ranked = [...(firstPage?.items ?? [])].sort(
    (a, b) => (b.liked_count ?? 0) - (a.liked_count ?? 0)
  );
  for (const a of [hero, ...ranked]) {
    if (!a || seen.has(a.id)) continue;
    seen.add(a.id);
    stories.push(a);
    if (stories.length === MAX_STORIES) break;
  }

  if (stories.length === 0) return null;

  const req = active?.requirements;
  const ActiveKindIcon = active?.kind === "workflow" ? Workflow : MessageSquare;

  return (
    <section className="mb-6">
      <p className="mb-3 font-semibold text-[11px] text-neutral-400 uppercase tracking-wider">
        {t("trending.label")}
      </p>
      {/* py-1 gives the hover scale headroom — without it the ring clips at the top. */}
      <div className="no-scrollbar flex gap-4 overflow-x-auto py-1">
        {stories.map((agent, i) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => setActive(agent)}
            className="group flex w-[4.25rem] shrink-0 flex-col items-center gap-1.5"
          >
            <span className="relative transition-transform duration-150 group-hover:scale-[1.03]">
              <StoryRing
                name={agent.name}
                size="size-14"
                text="text-base"
                ring="p-[2px]"
                animated={i === 0}
              />
              {i === 0 && (
                <span className="-bottom-1 -translate-x-1/2 absolute left-1/2 rounded-md border-2 border-white bg-neutral-950 px-1.5 py-px font-bold text-[9px] text-white uppercase tracking-wide">
                  Top
                </span>
              )}
            </span>
            <span className="w-full truncate text-center text-[11.5px] text-neutral-600">
              {agent.name}
            </span>
          </button>
        ))}
      </div>

      {/* Story viewer — Apple-clean, centered */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-sm rounded-2xl p-6">
          {active && (
            <div className="flex flex-col items-center text-center">
              <StoryRing name={active.name} size="size-20" text="text-2xl" />
              <DialogTitle className="mt-3 font-semibold text-lg text-neutral-950 tracking-tight">
                {active.name}
              </DialogTitle>
              <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-neutral-500">
                <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-1.5 py-0.5">
                  <ActiveKindIcon className="size-3" />
                  {active.kind === "workflow" ? t("catalog.kindWorkflow") : t("catalog.kindChat")}
                </span>
                <span className="capitalize">{active.classification}</span>
                <span>v{active.version}</span>
              </div>

              {active.description && (
                <p className="mt-3 text-[13px] text-neutral-600 leading-relaxed">
                  {active.description}
                </p>
              )}

              {req && req.requires.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                  {req.requires.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 font-medium text-[11px] text-neutral-700"
                    >
                      <ConnectorIcon name={p} className="size-3.5" />
                      {TOOL_LABELS[p] ?? p}
                    </span>
                  ))}
                  {req.schedule?.cron && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                      <Clock className="size-3" />
                      {formatSchedule(req.schedule.cron, req.schedule.timezone ?? undefined)}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-4 text-neutral-500 text-xs">
                {active.rating && active.rating.count > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {active.rating.avg?.toFixed(1) ?? "—"}
                    <span className="text-neutral-400">({active.rating.count})</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Heart className="size-3.5" />
                  {active.liked_count ?? 0}
                </span>
              </div>

              <Link
                href={ROUTES.bazaarAgent(active.id)}
                className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary font-medium text-sm text-white transition-colors hover:bg-primary/90"
              >
                {t("trending.view")}
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
