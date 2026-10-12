"use client";

import { SkillDetailsDialog } from "@/components/bazaar/skill-details-dialog";
import { type SkillOut, api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Decision = "approve" | "reject" | "rescan" | "publish" | "unpublish";
/** Imports listed before "Show more". */
const FIRST_ROWS = 6;
const INVALIDATE = ["workspace-skills", "bazaar-skills", "skill-catalog", "notifications"];

type SavedPanel = { open: boolean; waiting: string } | null;

/** The viewer's saved choice while the waiting set is unchanged; otherwise
 * open exactly when something waits for review. */
export function panelOpenAt(saved: SavedPanel, waitingKey: string, hasWaiting: boolean): boolean {
  return saved && saved.waiting === waitingKey ? saved.open : hasWaiting;
}

/**
 * Open or closed, per workspace. It opens by itself when a skill is waiting
 * for review and is closed otherwise; the viewer's own choice wins until the
 * set of waiting skills changes (a new import reopens it). Browser storage is
 * only a convenience here — unavailable, the panel just follows the default.
 */
function usePanelOpen(workspaceId: string, waitingKey: string, hasWaiting: boolean) {
  const storageKey = `sila.skill-review.${workspaceId}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let saved: SavedPanel = null;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    } catch {
      saved = null;
    }
    setOpen(panelOpenAt(saved, waitingKey, hasWaiting));
  }, [storageKey, waitingKey, hasWaiting]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify({ open: next, waiting: waitingKey }));
    } catch {
      // Not remembered this time; the panel still toggles.
    }
  }
  return { open, toggle };
}

/**
 * The workspace's own imports, for a Reviewer+: each one's scan result and the
 * decision it needs. Only an approved skill can be published; a rejected one
 * can't be approved (the API enforces both — the buttons just follow it). An
 * Admin can also remove a skill (confirmed in the row).
 */
export function SkillReviewList({
  workspaceId,
  canRemove = false,
}: {
  workspaceId: string;
  canRemove?: boolean;
}) {
  const t = useTranslations("bazaar.skills");
  const token = useToken();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["workspace-skills", workspaceId],
    queryFn: () => api.skills.mine(workspaceId, token),
    enabled: !!token && !!workspaceId,
  });
  const all = data?.items ?? [];
  const waiting = all.filter((s) => s.vetting_status === "needs_review");
  const panel = usePanelOpen(
    workspaceId,
    waiting
      .map((s) => s.id)
      .sort()
      .join(","),
    waiting.length > 0
  );

  function refresh() {
    for (const key of INVALIDATE) void queryClient.invalidateQueries({ queryKey: [key] });
  }

  const decide = useMutation({
    mutationFn: ({ skill, decision }: { skill: SkillOut; decision: Decision }) =>
      api.skills.decide(workspaceId, skill.id, decision, token),
    onSuccess: (skill) => {
      toast(t("review.decided", { name: skill.name, status: statusLabel(skill) }), "success");
      refresh();
    },
    onError: (err: Error, { skill }) =>
      toast(t("review.failed", { name: skill.name, error: err.message }), "error"),
  });

  const remove = useMutation({
    mutationFn: (skill: SkillOut) => api.skills.remove(workspaceId, skill.id, token),
    onSuccess: (_void, skill) => {
      toast(t("review.removed", { name: skill.name }), "success");
      setConfirmId(null);
      refresh();
    },
    onError: (err: Error, skill) =>
      toast(t("review.failed", { name: skill.name, error: err.message }), "error"),
  });

  function statusLabel(skill: SkillOut): string {
    if (skill.vetting_status === "approved" && !skill.published) return t("status.unpublished");
    return t(`status.${skill.vetting_status}`);
  }

  if (all.length === 0) return null;
  const items = expanded ? all : all.slice(0, FIRST_ROWS);
  const busy = decide.isPending || remove.isPending;

  return (
    <div className="mt-8 rounded-xl border border-neutral-200">
      <button
        type="button"
        onClick={panel.toggle}
        aria-expanded={panel.open}
        aria-label={panel.open ? t("review.hide") : t("review.show")}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-neutral-50"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-900 text-sm">{t("review.title")}</span>
            <span className="text-neutral-500 text-xs">
              {t("review.count", { count: all.length })}
            </span>
            {waiting.length > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-[11px] text-amber-700">
                {t("review.waiting", { count: waiting.length })}
              </span>
            )}
          </span>
          <span className="block text-neutral-500 text-xs">{t("review.hint")}</span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-neutral-500 transition-transform ${
            panel.open ? "rotate-180" : ""
          }`}
        />
      </button>
      {panel.open && (
        <>
          <ul className="divide-y divide-neutral-100 border-neutral-100 border-t">
            {items.map((skill) => (
              <li key={skill.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpenId(skill.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-medium text-neutral-900 text-sm hover:underline">
                    {skill.name}
                  </p>
                  <p className="truncate text-[11.5px] text-neutral-500">
                    {skill.source} · {statusLabel(skill)}
                  </p>
                  <ScanResult skill={skill} />
                </button>
                {confirmId === skill.id ? (
                  <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-red-50 px-3 py-2 sm:w-auto sm:max-w-md">
                    <p className="min-w-0 flex-1 text-[12px] text-red-800">
                      {t("review.removeAsk", { name: skill.name })}
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove.mutate(skill)}
                      className="inline-flex h-8 items-center rounded-lg bg-red-600 px-3 font-medium text-white text-xs hover:bg-red-700 disabled:opacity-50"
                    >
                      {t("review.removeYes")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-white px-3 font-medium text-neutral-700 text-xs hover:bg-neutral-50"
                    >
                      {t("review.cancel")}
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 gap-1.5">
                    {actionsFor(skill).map((decision) => (
                      <button
                        key={decision}
                        type="button"
                        disabled={busy}
                        onClick={() => decide.mutate({ skill, decision })}
                        className={`inline-flex h-8 items-center rounded-lg px-3 font-medium text-xs disabled:opacity-50 ${
                          decision === "approve" || decision === "publish"
                            ? "bg-primary text-white hover:bg-primary/90"
                            : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {t(`review.${decision}`)}
                      </button>
                    ))}
                    {canRemove && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmId(skill.id)}
                        className="inline-flex h-8 items-center rounded-lg border border-red-200 px-3 font-medium text-red-700 text-xs hover:bg-red-50 disabled:opacity-50"
                      >
                        {t("review.remove")}
                      </button>
                    )}
                  </div>
                )}
                <SkillDetailsDialog
                  skillId={skill.id}
                  summary={skill}
                  workspaceId={workspaceId}
                  open={openId === skill.id}
                  onOpenChange={(open) => setOpenId(open ? skill.id : null)}
                />
              </li>
            ))}
          </ul>
          {all.length > FIRST_ROWS && (
            <div className="border-neutral-100 border-t px-4 py-2.5">
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="font-medium text-primary text-xs hover:underline"
              >
                {expanded ? t("showLess") : t("review.more", { count: all.length - FIRST_ROWS })}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function actionsFor(skill: SkillOut): Decision[] {
  if (skill.vetting_status === "needs_review") return ["approve", "reject", "rescan"];
  if (skill.vetting_status === "approved") {
    return [skill.published ? "unpublish" : "publish", "reject", "rescan"];
  }
  return ["rescan"];
}

function ScanResult({ skill }: { skill: SkillOut }) {
  const t = useTranslations("bazaar.skills");
  if (skill.findings.length === 0) {
    return (
      <p className="mt-1 flex items-start gap-1 text-[12px]">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
        <span className="text-neutral-600">{t("review.noFindings")}</span>
      </p>
    );
  }
  return (
    <p className="mt-1 flex items-start gap-1 text-[12px]">
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
      <span className="text-neutral-700">
        {t("review.findings")}:{" "}
        {skill.findings.map((f) => `${f.severity} — ${f.preview || f.type}`).join("; ")}
      </span>
    </p>
  );
}
