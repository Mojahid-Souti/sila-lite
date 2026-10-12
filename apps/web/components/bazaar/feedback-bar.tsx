"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Flag, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Reaction = "like" | "dislike" | null;

type Props = {
  agentId: string;
  workspaceId: string;
  token: string;
  initialReaction: Reaction;
  initialLikes: number;
  initialDislikes: number;
};

/** Like / dislike / report controls for an agent (Bazaar feedback). */
export function FeedbackBar({
  agentId,
  workspaceId,
  token,
  initialReaction,
  initialLikes,
  initialDislikes,
}: Props) {
  const t = useTranslations("bazaar.feedback");
  const [reaction, setReaction] = useState<Reaction>(initialReaction);
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);

  const reactMut = useMutation({
    mutationFn: (next: "like" | "dislike") => api.bazaar.react(agentId, workspaceId, next, token),
    onSuccess: (res) => {
      setLikes(res.liked_count);
      setDislikes(res.disliked_count);
      setReaction((res.my_reaction as Reaction) ?? null);
    },
  });

  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const reportMut = useMutation({
    mutationFn: () => api.bazaar.report(agentId, workspaceId, reason, token),
    onSuccess: () => {
      setReported(true);
      setReason("");
    },
  });

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={reactMut.isPending}
        onClick={() => reactMut.mutate("like")}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 font-medium text-sm transition-colors disabled:opacity-50 ${
          reaction === "like"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
        }`}
      >
        <ThumbsUp className="size-3.5" />
        {likes}
      </button>
      <button
        type="button"
        disabled={reactMut.isPending}
        onClick={() => reactMut.mutate("dislike")}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 font-medium text-sm transition-colors disabled:opacity-50 ${
          reaction === "dislike"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
        }`}
      >
        <ThumbsDown className="size-3.5" />
        {dislikes}
      </button>
      <button
        type="button"
        onClick={() => setReportOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-medium text-neutral-400 text-sm transition-colors hover:bg-neutral-50 hover:text-neutral-700"
      >
        <Flag className="size-3.5" />
        {t("report")}
      </button>

      <Dialog
        open={reportOpen}
        onOpenChange={(o) => {
          setReportOpen(o);
          if (!o) setReported(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("reportTitle")}</DialogTitle>
            <DialogDescription>{t("reportDescription")}</DialogDescription>
          </DialogHeader>
          {reported ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 text-sm">
              {t("reportThanks")}
            </p>
          ) : (
            <>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder={t("reportPlaceholder")}
                className="w-full rounded-lg border border-neutral-200 p-3 text-neutral-900 text-sm focus:border-neutral-400 focus:outline-none"
              />
              {reportMut.isError && (
                <p className="text-red-600 text-xs">
                  {reportMut.error instanceof Error ? reportMut.error.message : t("reportFailed")}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!reason.trim() || reportMut.isPending}
                  onClick={() => reportMut.mutate()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 font-medium text-sm text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {reportMut.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  {t("reportSubmit")}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
