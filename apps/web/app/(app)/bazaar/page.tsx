"use client";

export const dynamic = "force-dynamic";

import { useWorkspaces } from "@/components/app/workspace-context";
import { AgentCardSkeleton } from "@/components/bazaar/agent-card-skeleton";
import { BazaarAgentCard } from "@/components/bazaar/bazaar-agent-card";
import { CategoryFilter } from "@/components/bazaar/category-filter";
import { SearchBar } from "@/components/bazaar/search-bar";
import { SkillDetailsDialog } from "@/components/bazaar/skill-details-dialog";
import { SkillsSection } from "@/components/bazaar/skills-section";
import { TemplateCard } from "@/components/bazaar/template-card";
import { TrendingStrip } from "@/components/bazaar/trending-strip";
import { api } from "@/lib/api";
import { skillChatHref } from "@/lib/chat-links";
import { ROUTES } from "@/lib/constants";
import { publisherBrand } from "@/lib/publishers";
import { useToken } from "@/lib/use-token";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageSquare,
  ScrollText,
  SearchX,
  Store,
  Workflow,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

const PAGE_SIZE = 20;

type KindFilter = "all" | "chat" | "workflow" | "skills";

function BazaarCatalog() {
  const t = useTranslations("bazaar");
  const token = useToken();
  const { currentId } = useWorkspaces();
  const workspaceId = currentId ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get("q") ?? "";
  const catParam = searchParams.get("cat") ?? "";
  const selectedCats = catParam ? catParam.split(",").filter(Boolean) : [];
  const [page, setPage] = useState(1);
  // The Skills tab lives in the URL, so a notification can link straight to it.
  const kind: KindFilter = (() => {
    const tab = searchParams.get("tab");
    return tab === "skills" || tab === "chat" || tab === "workflow" ? tab : "all";
  })();
  const setKind = useCallback(
    (next: KindFilter) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "all") params.delete("tab");
      else params.set("tab", next);
      params.delete("skill");
      router.push(`${ROUTES.bazaar}?${params.toString()}`);
      setPage(1);
    },
    [router, searchParams]
  );
  const linkedSkill = searchParams.get("skill");

  const updateUrl = useCallback(
    (newQ: string, newCats: string[]) => {
      const params = new URLSearchParams();
      if (newQ) params.set("q", newQ);
      if (newCats.length) params.set("cat", newCats.join(","));
      const tab = searchParams.get("tab");
      if (tab) params.set("tab", tab);
      router.push(`${ROUTES.bazaar}?${params.toString()}`);
      setPage(1);
    },
    [router, searchParams]
  );

  const { data: categories } = useQuery({
    queryKey: ["bazaar-categories"],
    queryFn: () => api.bazaar.categories(token),
    enabled: !!token,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["bazaar-catalog", workspaceId, q, selectedCats, page],
    queryFn: () =>
      api.bazaar.list(workspaceId, token, { q, cat: selectedCats, page, size: PAGE_SIZE }),
    enabled: !!token && !!workspaceId && kind !== "skills",
    // Smooth filter/search transitions: keep the previous page on screen
    // (dimmed) while the next one loads, instead of flashing skeletons.
    placeholderData: keepPreviousData,
  });

  const items = (data?.items ?? []).filter((a) => kind === "all" || (a.kind ?? "chat") === kind);
  const hasFilters = q !== "" || selectedCats.length > 0 || kind !== "all";

  // Provenance sections (the manager's Bazaar redesign): My Agents · Shared with
  // Me · Created by my Org · Third-party. Only non-empty sections render.
  const SECTIONS = [
    { key: "mine", title: "My Agents" },
    { key: "shared", title: "Shared with Me" },
    { key: "org", title: "Created by my Org" },
    { key: "third_party", title: "Third-party" },
  ] as const;
  const grouped: Record<(typeof SECTIONS)[number]["key"], typeof items> = {
    mine: [],
    shared: [],
    org: [],
    third_party: [],
  };
  for (const a of items) grouped[a.provenance ?? "third_party"].push(a);
  const clearAll = () => {
    router.push(ROUTES.bazaar);
    setPage(1);
  };

  // Built-in templates (virtual listings) lead the grid on page 1, honoring the
  // active filters client-side (they're a code registry, not search-indexed).
  const { data: builtinTemplates } = useQuery({
    queryKey: ["bazaar-templates"],
    queryFn: () => api.bazaar.templates(token),
    enabled: !!token,
    staleTime: 5 * 60_000,
  });
  const selectedSlugs = new Set(
    (categories ?? []).filter((c) => selectedCats.includes(c.id)).map((c) => c.slug)
  );
  const ql = q.trim().toLowerCase();
  const templates = (builtinTemplates ?? []).filter(
    (tpl) =>
      page === 1 &&
      (kind === "all" || kind === "chat") &&
      (selectedSlugs.size === 0 || selectedSlugs.has(tpl.category_slug)) &&
      (ql === "" ||
        tpl.name.toLowerCase().includes(ql) ||
        tpl.description.toLowerCase().includes(ql))
  );

  // Templates group under their publisher's own heading, in the order the
  // registry returns them — an organisation's work should read as theirs, not
  // as anonymous platform furniture under a generic "Templates".
  const templatesByPublisher: [string, typeof templates][] = [];
  for (const tpl of templates) {
    const bucket = templatesByPublisher.find(([name]) => name === tpl.publisher);
    if (bucket) bucket[1].push(tpl);
    else templatesByPublisher.push([tpl.publisher, [tpl]]);
  }

  const kindTabs: { key: KindFilter; label: string; icon: typeof MessageSquare | null }[] = [
    { key: "all", label: "All", icon: null },
    { key: "chat", label: t("catalog.kindChat"), icon: MessageSquare },
    { key: "workflow", label: t("catalog.kindWorkflow"), icon: Workflow },
    { key: "skills", label: t("catalog.kindSkills"), icon: ScrollText },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-7">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl text-neutral-950 tracking-tight">
            {t("catalog.title")}
          </h1>
          <p className="mt-1 text-neutral-500 text-sm">{t("catalog.subtitle")}</p>
        </div>
        <Link
          href={ROUTES.hired}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 font-medium text-neutral-700 text-sm transition-colors hover:bg-neutral-50"
        >
          <Heart className="size-4" />
          {t("catalog.filterAll")}
        </Link>
      </div>

      <TrendingStrip workspaceId={workspaceId} token={token} />

      <div className="mb-5 flex flex-col gap-3 border-neutral-200 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <SearchBar
          value={q}
          onChange={(v) => updateUrl(v, selectedCats)}
          placeholder={t("catalog.searchPlaceholder")}
        />
        <div className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
          {kindTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              aria-pressed={kind === key}
              className={`inline-flex h-full items-center gap-1.5 rounded-md px-3 font-medium text-xs transition-colors ${
                kind === key
                  ? "bg-white text-neutral-950 shadow-sm ring-1 ring-neutral-200"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {Icon && <Icon className="size-3.5" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {linkedSkill && (
        <SkillDetailsDialog
          skillId={linkedSkill}
          workspaceId={workspaceId}
          open
          onOpenChange={(open) => {
            if (!open) setKind(kind);
          }}
          onUse={() => router.push(skillChatHref(linkedSkill))}
        />
      )}

      {kind === "skills" && <SkillsSection query={q} workspaceId={workspaceId} />}

      {kind !== "skills" && categories && categories.length > 0 && (
        <div className="mb-5">
          <CategoryFilter
            categories={categories}
            selected={selectedCats}
            onChange={(cats) => updateUrl(q, cats)}
            label={t("catalog.filterCategories")}
          />
        </div>
      )}

      {kind !== "skills" && isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* No matches for an active search/filter — offer a way OUT, not "Build". */}
      {kind !== "skills" &&
        !isLoading &&
        items.length === 0 &&
        templates.length === 0 &&
        hasFilters && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 border-dashed py-20 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
              <SearchX className="size-6" />
            </span>
            <p className="mt-4 font-medium text-neutral-900 text-sm">
              {t("catalog.noResultsTitle")}
            </p>
            <p className="mt-1 max-w-xs text-neutral-500 text-xs">{t("catalog.empty")}</p>
            <button
              type="button"
              onClick={clearAll}
              className="mt-4 inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-white px-4 font-medium text-neutral-700 text-sm transition-colors hover:bg-neutral-50"
            >
              {t("catalog.clearFilters")}
            </button>
          </div>
        )}

      {/* A genuinely empty Bazaar — invite building. */}
      {kind === "all" &&
        !isLoading &&
        items.length === 0 &&
        templates.length === 0 &&
        !hasFilters && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 border-dashed py-20 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-neutral-100 text-neutral-400">
              <Store className="size-6" />
            </span>
            <p className="mt-4 font-medium text-neutral-900 text-sm">{t("catalog.emptyTitle")}</p>
            <p className="mt-1 max-w-xs text-neutral-500 text-xs">{t("catalog.emptyHint")}</p>
            <Link
              href={ROUTES.bazaar}
              className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 font-medium text-sm text-white hover:bg-primary/90"
            >
              {t("catalog.emptyCta")}
            </Link>
          </div>
        )}

      {kind !== "skills" && !isLoading && (items.length > 0 || templates.length > 0) && (
        <>
          <div
            className={`space-y-8 transition-opacity duration-200 ${
              isFetching ? "opacity-60" : "opacity-100"
            }`}
          >
            {/* Ready-to-use templates lead the catalog, under their publisher. */}
            {templatesByPublisher.map(([publisher, group]) => (
              <section key={publisher}>
                <SectionHeader
                  title={`${publisher} templates`}
                  count={group.length}
                  publisher={publisher}
                />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.map((tpl) => (
                    <TemplateCard key={tpl.id} template={tpl} />
                  ))}
                </div>
              </section>
            ))}
            {/* Four provenance sections, in order; empty ones are hidden. */}
            {SECTIONS.map(({ key, title }) => {
              const group = grouped[key];
              if (group.length === 0) return null;
              const heading =
                key === "org" && group[0]?.org_name ? `Created by ${group[0].org_name}` : title;
              return (
                <section key={key}>
                  <SectionHeader title={heading} count={group.length} />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.map((agent) => (
                      <BazaarAgentCard
                        key={agent.id}
                        agent={agent}
                        workspaceId={workspaceId}
                        token={token}
                        showCreator={key !== "mine"}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {kind === "all" && (
            <div className="mt-8">
              <SkillsSection
                compact
                query={q}
                workspaceId={workspaceId}
                onSeeAll={() => setKind("skills")}
              />
            </div>
          )}

          {/* Pager only when there IS more than one page — no "N agents found" label. */}
          {((data?.total ?? 0) > PAGE_SIZE || page > 1) && (
            <div className="mt-6 flex items-center justify-end text-neutral-500 text-sm">
              <div className="flex items-center gap-1">
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
                  disabled={(data?.items.length ?? 0) < PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * A section heading. With a `publisher` that has a wordmark on file, the mark
 * replaces the organisation's name in the heading — a wordmark IS the name set
 * in the brand's own type, so printing both reads as a stutter. The accessible
 * name still says it, through the image's alt text.
 */
function SectionHeader({
  title,
  count,
  publisher,
}: { title: string; count: number; publisher?: string }) {
  const brand = publisherBrand(publisher);
  return (
    <div className="mb-3 flex items-center gap-2.5">
      {brand ? (
        <span className="flex items-baseline gap-2">
          <img src={brand.logo} alt={brand.alt} className={brand.logoClass} />
          <span className="font-semibold text-neutral-900 text-sm">templates</span>
        </span>
      ) : (
        <h2 className="font-semibold text-neutral-900 text-sm">{title}</h2>
      )}
      <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-[11px] text-neutral-500">
        {count}
      </span>
    </div>
  );
}

export default function BazaarPage() {
  return (
    <Suspense fallback={<AgentCardSkeleton />}>
      <BazaarCatalog />
    </Suspense>
  );
}
