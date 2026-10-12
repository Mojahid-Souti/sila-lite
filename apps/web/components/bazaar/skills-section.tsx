"use client";

import { AgentCardSkeleton } from "@/components/bazaar/agent-card-skeleton";
import { CATEGORY_ICON, SkillCard } from "@/components/bazaar/skill-card";
import { SkillImportDialog } from "@/components/bazaar/skill-import-dialog";
import { SkillReviewList } from "@/components/bazaar/skill-review-list";
import { useWorkspaceRole } from "@/components/workspace/use-workspace-role";
import { api } from "@/lib/api";
import { useToken } from "@/lib/use-token";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Download, Loader2, ScrollText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Skills shown per "Show more" step on the Skills tab. */
const STEP = 12;
/** Skills the All view shows before "Show more skills". */
const COMPACT_SIZE = 4;
/** Category keys in the order the chips show (the API's skills.categories). */
const CATEGORY_KEYS = [
  "development",
  "data",
  "design",
  "writing",
  "marketing",
  "media",
  "productivity",
  "other",
] as const;
/** Roles that can approve, reject, publish and unpublish (OPA skill.approve). */
const REVIEWER_ROLES = new Set(["reviewer", "builder", "admin"]);

/**
 * Open-source skills in the Bazaar.
 *
 * `compact` (the All view): the most-installed few for the current search and
 * "Show more skills (N)" to the Skills tab. Full (the Skills tab): filters —
 * category, instructions only, licence stated, sort — a first batch and "Show
 * more", and for the workspace's Admin the importer, for Reviewers+ the review
 * list.
 */
export function SkillsSection({
  query,
  workspaceId,
  compact = false,
  onSeeAll,
}: {
  query: string;
  workspaceId: string;
  compact?: boolean;
  onSeeAll?: () => void;
}) {
  const t = useTranslations("bazaar.skills");
  const token = useToken();
  const { role, isAdmin } = useWorkspaceRole(workspaceId);
  const [category, setCategory] = useState<string | null>(null);
  const [instructionsOnly, setInstructionsOnly] = useState(false);
  const [licensedOnly, setLicensedOnly] = useState(false);
  const [sort, setSort] = useState<"popular" | "newest">("popular");
  const [importOpen, setImportOpen] = useState(false);

  // "Show more" rather than pages: each step fetches the next STEP skills.
  const filters = compact
    ? { q: query, size: COMPACT_SIZE }
    : { q: query, category, instructionsOnly, licensedOnly, sort, size: STEP };
  const { data, isLoading, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["bazaar-skills", filters],
      queryFn: ({ pageParam }) => api.skills.list(token, { ...filters, page: pageParam }),
      initialPageParam: 1,
      getNextPageParam: (last) =>
        !compact && last.page * last.size < last.total ? last.page + 1 : undefined,
      enabled: !!token,
      placeholderData: keepPreviousData,
    });
  const first = data?.pages[0];
  const skills = data?.pages.flatMap((p) => p.items) ?? [];
  const total = first?.total ?? 0;

  if (compact && !isLoading && skills.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <ScrollText className="size-4 text-emerald-600" />
        <h2 className="font-semibold text-neutral-900 text-sm">{t("sectionTitle")}</h2>
        {first && (
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-[11px] text-neutral-500">
            {total}
          </span>
        )}
        <span className="flex-1" />
        {!compact && isAdmin && (
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 font-medium text-neutral-700 text-xs hover:bg-neutral-50"
          >
            <Download className="size-3.5" />
            {t("import.button")}
          </button>
        )}
      </div>

      {!compact && (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-neutral-500 text-xs">{t("categoryLabel")}</span>
            <Chip active={category === null} onClick={() => setCategory(null)}>
              {t("allCategories")}
            </Chip>
            {CATEGORY_KEYS.map((key) => {
              const Icon = CATEGORY_ICON[key];
              const count = first?.categories[key] ?? 0;
              if (count === 0 && category !== key) return null;
              return (
                <Chip
                  key={key}
                  active={category === key}
                  onClick={() => setCategory(category === key ? null : key)}
                >
                  <Icon className="size-3" />
                  {t(`categories.${key}`)}
                  <span className="text-neutral-400">{count}</span>
                </Chip>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={instructionsOnly} onClick={() => setInstructionsOnly((v) => !v)}>
              {t("filterInstructionsOnly")}
            </Chip>
            <Chip active={licensedOnly} onClick={() => setLicensedOnly((v) => !v)}>
              {t("filterLicensed")}
            </Chip>
            <span className="flex-1" />
            {(["popular", "newest"] as const).map((key) => (
              <Chip key={key} active={sort === key} onClick={() => setSort(key)}>
                {key === "popular" ? t("sortPopular") : t("sortNewest")}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 border-dashed px-6 py-12 text-center">
          <p className="font-medium text-neutral-900 text-sm">
            {query || category || instructionsOnly || licensedOnly
              ? t("noResults")
              : t("emptyTitle")}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-neutral-500 text-xs">{t("emptyHint")}</p>
        </div>
      ) : (
        <div
          className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
            isFetching && !isFetchingNextPage ? "opacity-60" : ""
          }`}
        >
          {skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}

      {/* A long list stays short: the rest is one click away. */}
      {(compact ? total > skills.length : hasNextPage) && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={isFetchingNextPage}
            onClick={() => (compact ? onSeeAll?.() : fetchNextPage())}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-4 font-medium text-neutral-700 text-sm hover:bg-neutral-50 disabled:opacity-50"
          >
            {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
            {t("showMoreCount", { count: total - skills.length })}
          </button>
        </div>
      )}

      {!compact && role && REVIEWER_ROLES.has(role) && (
        <SkillReviewList workspaceId={workspaceId} canRemove={isAdmin} />
      )}
      {isAdmin && (
        <SkillImportDialog
          workspaceId={workspaceId}
          open={importOpen}
          onOpenChange={setImportOpen}
        />
      )}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium text-xs transition-colors ${
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50"
      }`}
    >
      {children}
    </button>
  );
}
