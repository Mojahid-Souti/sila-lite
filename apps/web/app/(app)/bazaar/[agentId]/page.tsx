"use client";

export const dynamic = "force-dynamic";

import { TOOL_LABELS } from "@/components/agent/agent-card";
import { useWorkspaces } from "@/components/app/workspace-context";
import { FeedbackBar } from "@/components/bazaar/feedback-bar";
import { HireButton } from "@/components/bazaar/hire-button";
import { RatingStars } from "@/components/bazaar/rating-stars";
import { ReviewForm } from "@/components/bazaar/review-form";
import { api } from "@/lib/api";
import { ConnectorIcon } from "@/lib/connector-icons";
import { ROUTES } from "@/lib/constants";
import { SOVEREIGNTY_NOTE, describeListing } from "@/lib/describe-agent";
import { formatSchedule } from "@/lib/schedule";
import { useToken } from "@/lib/use-token";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Coins, FileText, Lock, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { use, useState } from "react";

type Props = { params: Promise<{ agentId: string }> };

export default function BazaarAgentDetailPage({ params }: Props) {
  const { agentId } = use(params);
  const t = useTranslations("bazaar");
  const qc = useQueryClient();
  const token = useToken();
  const { currentId } = useWorkspaces();
  const workspaceId = currentId ?? "";
  const [reviewPage, setReviewPage] = useState(1);

  // Built-in templates are VIRTUAL listings (tpl-… ids) — no agent row, no
  // reviews. They render their own detail from the registry payload.
  const isTemplate = agentId.startsWith("tpl-");

  const { data: agent, isLoading } = useQuery({
    queryKey: ["bazaar-agent", agentId, workspaceId],
    queryFn: () => api.bazaar.get(agentId, workspaceId, token),
    enabled: !!token && !!workspaceId && !isTemplate,
  });
  const { data: templates } = useQuery({
    queryKey: ["bazaar-templates"],
    queryFn: () => api.bazaar.templates(token),
    enabled: !!token && isTemplate,
    staleTime: 5 * 60_000,
  });

  if (isTemplate) {
    const tpl = (templates ?? []).find((x) => x.id === agentId);
    if (!tpl) return <p className="text-neutral-500 text-sm">Template not found.</p>;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-bold text-2xl text-neutral-950">{tpl.name}</h1>
            <p className="mt-1 text-neutral-600 text-sm">{tpl.description}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tpl.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <Link
            href={`${ROUTES.dashboard}?template=${tpl.id}`}
            className="inline-flex h-9 shrink-0 items-center rounded-lg bg-primary px-4 font-medium text-sm text-white transition-colors hover:bg-primary/90"
          >
            {t("templates.useButton")}
          </Link>
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-neutral-700 text-sm leading-relaxed">{tpl.chip_hint}</p>
          <p className="flex items-center gap-1.5 text-[11.5px] text-neutral-400">
            <Lock className="size-3 shrink-0" />
            {SOVEREIGNTY_NOTE}
          </p>
        </div>
      </div>
    );
  }

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ["bazaar-reviews", agentId, reviewPage],
    queryFn: () => api.bazaar.reviews(agentId, token, reviewPage),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-neutral-100" />
        <div className="h-24 animate-pulse rounded bg-neutral-100" />
      </div>
    );
  }

  if (!agent) return <p className="text-sm text-neutral-500">Agent not found.</p>;

  const rating = agent.rating;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-950">{agent.name}</h1>
          <p className="mt-1 text-sm text-neutral-600">{agent.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {agent.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <HireButton
          agentId={agentId}
          workspaceId={workspaceId}
          token={token}
          initialHired={agent.hired}
          agent={agent}
          onToggle={() => qc.invalidateQueries({ queryKey: ["bazaar-agent", agentId] })}
        />
      </div>

      {/* What it does / what you'll need — SANITIZED (provider types only). */}
      {agent.kind === "workflow" && agent.requirements && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm leading-relaxed text-neutral-700">
            {describeListing(agent.requirements)}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {agent.requirements.requires.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 font-medium text-neutral-700"
              >
                <ConnectorIcon name={p} className="size-3.5" />
                {TOOL_LABELS[p] ?? p}
              </span>
            ))}
            {agent.requirements.schedule?.cron && (
              <span className="inline-flex items-center gap-1 text-neutral-500">
                <Clock className="size-3.5" />
                {formatSchedule(
                  agent.requirements.schedule.cron,
                  agent.requirements.schedule.timezone ?? undefined
                )}
              </span>
            )}
            {agent.requirements.docs_count > 0 && (
              <span className="inline-flex items-center gap-1 text-neutral-500">
                <FileText className="size-3.5" />
                {agent.requirements.data_mode === "included"
                  ? `${agent.requirements.docs_count} documents included`
                  : "you attach your own documents"}
              </span>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-[11.5px] text-neutral-400">
            <Lock className="size-3 shrink-0" />
            {SOVEREIGNTY_NOTE}
          </p>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-6 rounded-lg border p-4 text-sm">
        <div>
          <span className="font-medium text-neutral-700">{t("agent.classification")}: </span>
          <span className="capitalize text-neutral-600">{agent.classification}</span>
        </div>
        <div>
          <span className="font-medium text-neutral-700">{t("agent.version")}: </span>
          <span className="text-neutral-600">v{agent.version}</span>
        </div>
        {agent.creator && (
          <div>
            <span className="font-medium text-neutral-700">Created by: </span>
            <span className="text-neutral-600">
              {agent.creator}
              {agent.org_name ? ` · ${agent.org_name}` : ""}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {rating && rating.count >= 1 ? (
            <>
              <RatingStars value={rating.avg ?? 0} readonly />
              <span className="text-neutral-500">
                {rating.avg !== null ? rating.avg.toFixed(1) : "—"} ({rating.count}{" "}
                {t("agent.ratingCount", { count: rating.count })})
              </span>
            </>
          ) : (
            <span className="text-neutral-400">{t("agent.noRatings")}</span>
          )}
        </div>
      </div>

      {/* Permissions + token usage (the manager's agent-card fields) */}
      <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 font-medium text-neutral-700 text-sm">
            <Wrench className="size-3.5 text-neutral-400" /> Permissions
          </p>
          {agent.permissions && agent.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {agent.permissions.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-2 py-0.5 font-medium text-neutral-700 text-xs"
                >
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-neutral-400 text-xs">No tools granted</p>
          )}
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 font-medium text-neutral-700 text-sm">
            <Coins className="size-3.5 text-neutral-400" /> Token usage
          </p>
          <p className="font-semibold text-lg text-neutral-900">
            {(agent.token_usage ?? 0).toLocaleString()}
            <span className="ml-1 font-normal text-neutral-400 text-xs">tokens</span>
          </p>
        </div>
      </div>

      {/* Feedback — like / dislike / report */}
      <FeedbackBar
        agentId={agentId}
        workspaceId={workspaceId}
        token={token}
        initialReaction={agent.my_reaction ?? null}
        initialLikes={agent.liked_count ?? 0}
        initialDislikes={agent.disliked_count ?? 0}
      />

      {/* Reviews */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-neutral-950">{t("review.title")}</h2>

        <ReviewForm
          agentId={agentId}
          workspaceId={workspaceId}
          token={token}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["bazaar-reviews", agentId] });
            qc.invalidateQueries({ queryKey: ["bazaar-agent", agentId] });
          }}
        />

        {reviewsLoading && <div className="mt-4 h-20 animate-pulse rounded bg-neutral-100" />}

        {!reviewsLoading && reviews && reviews.items.length === 0 && (
          <p className="mt-4 text-sm text-neutral-500">{t("review.empty")}</p>
        )}

        {reviews && reviews.items.length > 0 && (
          <ul className="mt-4 space-y-4">
            {reviews.items.map((r) => (
              <li key={r.id} className="rounded-lg border p-4">
                <div className="mb-1 flex items-center gap-2">
                  <RatingStars value={r.rating} readonly />
                  <span className="text-xs text-neutral-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.body && <p className="text-sm text-neutral-700">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}

        {reviews && reviews.total > reviews.items.length && (
          <button
            type="button"
            onClick={() => setReviewPage((p) => p + 1)}
            className="mt-4 text-sm text-neutral-700 hover:underline"
          >
            {t("review.loadMore")}
          </button>
        )}
      </div>
    </div>
  );
}
