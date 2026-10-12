"use client";

export const dynamic = "force-dynamic";

import { useWorkspaces } from "@/components/app/workspace-context";
import { AgentCardSkeleton } from "@/components/bazaar/agent-card-skeleton";
import { BazaarAgentCard } from "@/components/bazaar/bazaar-agent-card";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

const PAGE_SIZE = 20;

export default function HiredPage() {
  const t = useTranslations("bazaar.hired");
  const qc = useQueryClient();
  const token = useToken();
  const { currentId } = useWorkspaces();
  const workspaceId = currentId ?? "";
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["hires", workspaceId, page],
    queryFn: () => api.hires.list(workspaceId, token, page),
    enabled: !!token && !!workspaceId,
  });

  const items = data?.items ?? [];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-7">
      <div className="mb-6 border-neutral-200 border-b pb-5">
        <h1 className="font-semibold text-2xl text-neutral-950 tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-neutral-500 text-sm">{t("subtitle")}</p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 border-dashed py-20 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
            <Heart className="size-6" />
          </span>
          <p className="mt-4 font-medium text-neutral-900 text-sm">{t("emptyTitle")}</p>
          <p className="mt-1 max-w-xs text-neutral-500 text-xs">{t("empty")}</p>
          <Link
            href={ROUTES.bazaar}
            className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 font-medium text-sm text-white hover:bg-primary/90"
          >
            {t("emptyCta")}
          </Link>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((agent) => (
              <BazaarAgentCard
                key={agent.id}
                agent={{ ...agent, hired: true }}
                workspaceId={workspaceId}
                token={token}
                hiredVariant
                onUnhire={() => qc.invalidateQueries({ queryKey: ["hires", workspaceId] })}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center justify-end gap-1 text-neutral-500 text-sm">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 text-neutral-600 text-xs">Page {page}</span>
            <button
              type="button"
              disabled={items.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
