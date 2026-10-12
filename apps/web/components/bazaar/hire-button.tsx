"use client";

import { HireSetupDialog } from "@/components/bazaar/hire-setup-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type BazaarAgentOut, api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookmarkCheck, Check, Loader2, SquarePen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Props = {
  agentId: string;
  workspaceId: string;
  token: string;
  initialHired: boolean;
  // When the full agent (with sanitized requirements) is supplied and it's a
  // workflow agent, Hire opens the adaptive setup — the hirer gets their OWN
  // runnable copy. Chat agents keep the plain bookmark hire.
  agent?: BazaarAgentOut;
  /** IG-style save icon (the catalog cards' action row) instead of a labeled button. */
  iconOnly?: boolean;
  onToggle?: () => void;
};

export function HireButton({
  agentId,
  workspaceId,
  token,
  initialHired,
  agent,
  iconOnly,
  onToggle,
}: Props) {
  const t = useTranslations("bazaar.agent");
  const [hired, setHired] = useState(initialHired);
  const [setupOpen, setSetupOpen] = useState(false);

  const isWorkflow = agent?.kind === "workflow" && !!agent.requirements;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // The toast now; the bell keeps the record (the server wrote it with the hire).
  const announceHire = () => {
    toast(t("hiredToast", { name: agent?.name ?? "" }), "success");
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const hireMut = useMutation({
    mutationFn: () => api.hires.hire(workspaceId, agentId, token),
    onSuccess: () => {
      setHired(true);
      announceHire();
      onToggle?.();
    },
  });

  const unhireMut = useMutation({
    mutationFn: () => api.hires.unhire(workspaceId, agentId, token),
    onSuccess: () => {
      setHired(false);
      onToggle?.();
    },
  });

  const loading = hireMut.isPending || unhireMut.isPending;
  const startHire = () => (isWorkflow ? setSetupOpen(true) : hireMut.mutate());

  const dialog = isWorkflow && agent && (
    <HireSetupDialog
      open={setupOpen}
      onClose={() => setSetupOpen(false)}
      agent={agent}
      workspaceId={workspaceId}
      token={token}
      onHired={() => {
        setHired(true);
        announceHire();
        onToggle?.();
      }}
    />
  );

  if (iconOnly) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={loading}
              onClick={() => (hired ? unhireMut.mutate() : startHire())}
              aria-label={hired ? t("unhireButton") : t("hireButton")}
              className="grid size-8 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : hired ? (
                <BookmarkCheck className="size-[18px] fill-neutral-900 text-neutral-900" />
              ) : (
                <SquarePen className="size-[18px]" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {hired ? t("hiredTooltip") : t("hireSetupTooltip")}
          </TooltipContent>
        </Tooltip>
        {dialog}
      </>
    );
  }

  if (hired) {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => unhireMut.mutate()}
        className="group inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 font-medium text-neutral-700 text-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Check className="size-3.5 text-emerald-600 group-hover:hidden" />
        )}
        <span className="group-hover:hidden">{t("hiredButton")}</span>
        <span className="hidden group-hover:inline">{t("unhireButton")}</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={loading}
        onClick={startHire}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 font-medium text-sm text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {loading && <Loader2 className="size-3.5 animate-spin" />}
        {t("hireButton")}
      </button>
      {dialog}
    </>
  );
}
