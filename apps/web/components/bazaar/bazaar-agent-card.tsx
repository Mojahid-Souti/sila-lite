"use client";

import { TOOL_LABELS, ToolGlyph } from "@/components/agent/agent-card";
import { HireButton } from "@/components/bazaar/hire-button";
import { StoryRing } from "@/components/bazaar/story-ring";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type BazaarAgentOut, api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { formatSchedule } from "@/lib/schedule";
import { useMutation } from "@tanstack/react-query";
import { Check, Clock, FileText, Heart, MessageSquare, Send, Star, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

/**
 * Bazaar catalog card, Instagram-feed anatomy (Mojahid's design): header row
 * with the agent's ringed monogram avatar, a UNIFORM cover block carrying the
 * agent's info (connector logos + kind/schedule line), then the IG action row
 * — a working like heart, a share (copy link), and the bookmark = Hire — and
 * the description as the caption. The whole card links to the listing;
 * interactive controls float above the link (z-10).
 */

type Props = {
  agent: BazaarAgentOut;
  workspaceId: string;
  token: string;
  /** Hired view: lead with an Open action next to the bookmark. */
  hiredVariant?: boolean;
  onUnhire?: () => void;
  /** Show a "by {creator}" provenance label (Shared / Org / Third-party sections). */
  showCreator?: boolean;
};

// Subtle dot color per data-classification level — neutral card, semantic dot.
const CLASSIFICATION_DOT: Record<string, string> = {
  public: "bg-emerald-500",
  internal: "bg-sky-500",
  restricted: "bg-amber-500",
  confidential: "bg-red-500",
};

/** Large overlapping connector logos for the cover (up to four, then +N). */
function CoverToolRow({ types }: { types: string[] }) {
  const shown = types.slice(0, 4);
  return (
    <span className="-space-x-2.5 flex">
      {shown.map((tool) => (
        <span
          key={tool}
          title={TOOL_LABELS[tool] ?? tool}
          className="grid size-10 place-items-center rounded-full border border-neutral-200 bg-white shadow-sm ring-2 ring-white"
        >
          <ToolGlyph type={tool} className="size-[18px]" />
        </span>
      ))}
      {types.length > 4 && (
        <span className="grid size-10 place-items-center rounded-full border border-neutral-200 bg-neutral-50 font-semibold text-neutral-500 text-xs ring-2 ring-white">
          +{types.length - 4}
        </span>
      )}
    </span>
  );
}

export function BazaarAgentCard({
  agent,
  workspaceId,
  token,
  hiredVariant,
  onUnhire,
  showCreator,
}: Props) {
  const t = useTranslations("bazaar.agent");
  const rating = agent.rating;
  const req = agent.requirements;
  const tools = req?.requires ?? [];
  const isWorkflow = agent.kind === "workflow";
  const KindIcon = isWorkflow ? Workflow : MessageSquare;

  // IG-style like — optimistic-ish: the endpoint returns the fresh counts.
  const [liked, setLiked] = useState(agent.my_reaction === "like");
  const [likeCount, setLikeCount] = useState(agent.liked_count ?? 0);
  const likeMut = useMutation({
    mutationFn: (next: "like" | null) => api.bazaar.react(agent.id, workspaceId, next, token),
    onSuccess: (res) => {
      setLiked(res.my_reaction === "like");
      setLikeCount(res.liked_count);
    },
  });

  // Share = copy the listing link (brief ✓ feedback).
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${ROUTES.bazaarAgent(agent.id)}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — non-critical */
    }
  }

  return (
    <div className="relative flex flex-col rounded-xl border border-neutral-200 bg-white p-3.5 transition-shadow hover:shadow-md">
      <Link
        href={ROUTES.bazaarAgent(agent.id)}
        className="absolute inset-0 rounded-xl"
        aria-label={`Open ${agent.name}`}
      />

      {/* Header — ringed avatar + name/kind, classification dot right */}
      <div className="flex items-center gap-2.5">
        <StoryRing name={agent.name} size="size-8" text="text-[11px]" ring="p-[1.5px]" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[14px] text-neutral-900 leading-tight">
            {agent.name}
          </h3>
          <p className="flex items-center gap-1 text-[11px] text-neutral-500">
            <KindIcon className="size-3" />
            {isWorkflow ? t("kindWorkflow") : t("kindChat")} · v{agent.version}
          </p>
          {showCreator && agent.creator && (
            <p className="truncate text-[11px] text-neutral-400">
              by <span className="font-medium text-neutral-500">{agent.creator}</span>
              {agent.provenance === "third_party" && agent.org_name ? ` · ${agent.org_name}` : ""}
            </p>
          )}
        </div>
        <span
          title={t("classification")}
          className="inline-flex shrink-0 items-center gap-1.5 font-medium text-[11px] text-neutral-500 capitalize"
        >
          <span
            className={`size-2 rounded-full ${CLASSIFICATION_DOT[agent.classification] ?? "bg-neutral-300"}`}
          />
          {agent.classification}
        </span>
      </div>

      {/* Cover — uniform "post media": the agent's info at a glance */}
      <div className="relative mt-3 grid h-28 place-items-center overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50/70">
        <div className="flex flex-col items-center gap-2">
          {tools.length > 0 ? (
            <CoverToolRow types={tools} />
          ) : (
            <span className="grid size-10 place-items-center rounded-full border border-neutral-200 bg-white shadow-sm">
              <KindIcon className="size-[18px] text-neutral-400" />
            </span>
          )}
          <p className="flex items-center gap-2 text-[11px] text-neutral-500">
            {req?.schedule?.cron ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {formatSchedule(req.schedule.cron, req.schedule.timezone ?? undefined)}
              </span>
            ) : (
              <span>{isWorkflow ? t("kindWorkflow") : t("kindChat")}</span>
            )}
            {(req?.docs_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" />
                {req?.docs_count === 1 ? "1 doc" : `${req?.docs_count} docs`}
              </span>
            )}
          </p>
        </div>
        {rating && rating.count > 0 && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10.5px] text-neutral-600 shadow-sm ring-1 ring-neutral-200">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {rating.avg !== null ? rating.avg.toFixed(1) : "—"}
          </span>
        )}
      </div>

      {/* Action row — like / share left, Open + hire right (all tooltipped) */}
      <TooltipProvider delayDuration={200}>
        <div className="relative z-10 mt-1.5 flex items-center justify-between">
          <span className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={likeMut.isPending}
                  onClick={() => likeMut.mutate(liked ? null : "like")}
                  aria-pressed={liked}
                  aria-label={t("likeAction")}
                  className="grid size-8 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
                >
                  <Heart
                    className={`size-[18px] transition-colors ${liked ? "fill-rose-500 text-rose-500" : ""}`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("likeAction")}</TooltipContent>
            </Tooltip>
            {likeCount > 0 && (
              <span className="-ml-0.5 mr-1 font-medium text-[11.5px] text-neutral-600">
                {likeCount}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={share}
                  aria-label={t("shareAction")}
                  className="grid size-8 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {copied ? (
                    <Check className="size-[18px] text-emerald-600" />
                  ) : (
                    <Send className="size-[18px]" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{t("shareAction")}</TooltipContent>
            </Tooltip>
          </span>
          <span className="flex items-center gap-1">
            {hiredVariant && (
              <Link
                href={ROUTES.bazaarAgent(agent.id)}
                className="inline-flex h-8 items-center rounded-lg border border-neutral-200 px-3 font-medium text-neutral-700 text-sm transition-colors hover:bg-neutral-50"
              >
                {t("openButton")}
              </Link>
            )}
            <HireButton
              agentId={agent.id}
              workspaceId={workspaceId}
              token={token}
              initialHired={agent.hired}
              agent={agent}
              iconOnly
              onToggle={onUnhire}
            />
          </span>
        </div>
      </TooltipProvider>

      {/* Caption */}
      {agent.description && (
        <p className="line-clamp-2 text-[12.5px] text-neutral-600 leading-relaxed">
          {agent.description}
        </p>
      )}
    </div>
  );
}
