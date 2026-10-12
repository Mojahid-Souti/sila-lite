"use client";

export const dynamic = "force-dynamic";

import { AgentCard } from "@/components/agent/agent-card";
import { useWorkspaces } from "@/components/app/workspace-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CardGridSkeleton } from "@/components/ui/page-skeletons";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, Loader2, Search, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * "My agents" — the end-user (Simple shell) view of the current workspace's agents.
 * A clean card grid (no builder chrome); each card's Edit opens the centered config
 * modal. Bulk delete mirrors the Advanced agents page (pause → archive).
 */
export default function MyAgentsPage() {
  const { currentId } = useWorkspaces();
  const workspaceId = currentId as string;
  const token = useToken();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["agents", workspaceId],
    queryFn: () => api.agents.list(workspaceId, token as string),
    enabled: Boolean(workspaceId && token),
  });

  const items = data?.items ?? [];
  const archivedCount = useMemo(() => items.filter((a) => a.status === "archived").length, [items]);
  const filtered = useMemo(() => {
    // Newest first — a stable, predictable order (the API's felt random).
    const sorted = [...items].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
    // Archived agents leave the main view and live in their own tab.
    const scoped = sorted.filter((a) =>
      view === "archived" ? a.status === "archived" : a.status !== "archived"
    );
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q)
    );
  }, [items, query, view]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setDeleteFailed(0);
  }

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const chosen = items.filter((a) => selected.has(a.id));
      const results = await Promise.allSettled(
        chosen.map(async (a) => {
          if (a.publisher_config?.active) {
            await api.agents.setActivation(workspaceId, a.id, false, token as string);
          }
          await api.agents.archive(workspaceId, a.id, token as string);
        })
      );
      return results.filter((r) => r.status === "rejected").length;
    },
    onSuccess: (failed) => {
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["agents", workspaceId] });
      if (failed > 0) {
        setDeleteFailed(failed);
        setSelected(new Set());
        setSelectMode(true); // keep the bar visible so the failure note is seen
      } else {
        exitSelectMode();
      }
    },
  });

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-6 lg:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">My agents</h1>
          <p className="text-sm text-neutral-500">
            {items.length === 0
              ? "Agents you build with SILA show up here."
              : `${items.length} ${items.length === 1 ? "agent" : "agents"} in this workspace.`}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            {archivedCount > 0 && (
              <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5">
                {(["active", "archived"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      setView(v);
                      exitSelectMode();
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      view === v
                        ? "bg-neutral-950 text-white"
                        : "text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {v === "active" ? "Active" : `Archived (${archivedCount})`}
                  </button>
                ))}
              </div>
            )}
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              >
                <Search className="size-4" />
              </span>
              <input
                type="text"
                placeholder="Search agents…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-200 sm:w-64"
              />
            </div>
            {view === "active" && (
              <button
                type="button"
                title="Delete agents"
                aria-label="Delete agents"
                aria-pressed={selectMode}
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                  selectMode
                    ? "border-red-300 bg-red-50 text-red-600"
                    : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-red-600"
                }`}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        )}
      </header>

      {selectMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
          <span className="text-sm text-neutral-700">
            {deleteFailed > 0
              ? `${deleteFailed} ${deleteFailed === 1 ? "agent" : "agents"} couldn't be deleted.`
              : selected.size === 0
                ? "Select the agents to delete."
                : `${selected.size} selected`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelected(
                  selected.size === filtered.length ? new Set() : new Set(filtered.map((a) => a.id))
                )
              }
              className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            >
              {selected.size === filtered.length && filtered.length > 0
                ? "Clear all"
                : "Select all"}
            </button>
            <button
              type="button"
              onClick={exitSelectMode}
              className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={() => setConfirmOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
            >
              <Trash2 className="size-3.5" />
              Delete{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <EmptyState searching={Boolean(query)} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((agent) => (
            <div key={agent.id} className="relative">
              <AgentCard agent={agent} workspaceId={workspaceId} />
              {selectMode && (
                <button
                  type="button"
                  onClick={() => toggleSelected(agent.id)}
                  aria-pressed={selected.has(agent.id)}
                  aria-label={`Select ${agent.name}`}
                  className={`absolute inset-0 z-20 rounded-xl border-2 text-left transition-colors ${
                    selected.has(agent.id)
                      ? "border-red-500 bg-red-500/5"
                      : "border-transparent hover:border-neutral-300"
                  }`}
                >
                  <span
                    className={`absolute left-3 top-3 grid size-5 place-items-center rounded border transition-colors ${
                      selected.has(agent.id)
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {selected.has(agent.id) && <Check className="size-3.5" />}
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete {selected.size} {selected.size === 1 ? "agent" : "agents"}?
            </DialogTitle>
            <DialogDescription>
              Active agents are paused first, then archived — removed from lists immediately and
              permanently purged after 90 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="h-9 rounded-lg border border-neutral-200 bg-white px-3.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkDelete.isPending}
              onClick={() => bulkDelete.mutate()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {bulkDelete.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  if (searching) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center text-sm text-neutral-500">
        No agents match your search.
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white py-16 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-neutral-100 text-neutral-500">
        <Bot className="size-5" />
      </span>
      <h3 className="mt-3 text-base font-semibold text-neutral-950">No agents yet</h3>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        Ask SILA to build one — "build an agent that summarizes my docs and posts to Slack."
      </p>
      <Link
        href={ROUTES.dashboard}
        className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-neutral-950 px-3.5 text-sm font-medium text-white hover:bg-neutral-800"
      >
        <Sparkles className="size-4" /> Build an agent
      </Link>
    </div>
  );
}
