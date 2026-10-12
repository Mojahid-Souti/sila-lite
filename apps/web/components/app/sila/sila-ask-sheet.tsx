"use client";

import { SilaSchedulePicker } from "@/components/app/sila/sila-schedule-picker";
import type { SilaAsk, SilaAskAnswers } from "@/lib/sila-socket";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import { useState } from "react";

const HIGHLIGHT_MS = 250;

/**
 * Generic elicitation panel — a step-through wizard that renders whatever the
 * model asked (the `ask_user` payload); zero hardcoded question text. One
 * question per step. single_select auto-advances on tap (after a brief
 * highlight); multi_select and the "Other…" text box keep an explicit Next.
 * Docked above the composer (positioning lives in sila-chat).
 */
export function SilaAskSheet({
  ask,
  onSubmit,
  onClose,
}: {
  ask: SilaAsk;
  onSubmit: (answers: SilaAskAnswers) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<SilaAskAnswers>({});
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const q = ask.questions[step];
  const total = ask.questions.length;
  const isLast = step === total - 1;
  const multi = q.select === "multi_select";

  function resetStepState() {
    setOtherOpen(false);
    setOtherText("");
    setPicked(null);
  }

  function commit(next: SilaAskAnswers) {
    // Persist before advancing — the schedule wheel and the "Other…" text pass their
    // answer only through `next`; without this, a mid-wizard answer was dropped and
    // the gate re-asked it (the double schedule ask).
    setAnswers(next);
    if (isLast) {
      onSubmit(next);
      return;
    }
    setStep((s) => s + 1);
    resetStepState();
  }

  function pickSingle(option: string) {
    const next = { ...answers, [q.id]: option };
    setAnswers(next);
    setOtherOpen(false);
    setPicked(option);
    // Brief highlight so the tap registers, then slide on.
    window.setTimeout(() => commit(next), HIGHLIGHT_MS);
  }

  function toggleMulti(option: string) {
    setOtherOpen(false);
    setAnswers((prev) => {
      const arr = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
      return {
        ...prev,
        [q.id]: arr.includes(option) ? arr.filter((o) => o !== option) : [...arr, option],
      };
    });
  }

  function confirm() {
    // Used by Next/Done — for multi_select, or when "Other" text is entered.
    if (otherOpen) {
      const text = otherText.trim();
      if (!text) return;
      const next = multi
        ? {
            ...answers,
            [q.id]: [...(Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []), text],
          }
        : { ...answers, [q.id]: text };
      commit(next);
      return;
    }
    commit(answers);
  }

  function back() {
    if (step === 0) {
      onClose();
      return;
    }
    setStep((s) => s - 1);
    resetStepState();
  }

  function isSelected(option: string) {
    const v = answers[q.id];
    return multi ? Array.isArray(v) && v.includes(option) : v === option;
  }

  const multiValid = Array.isArray(answers[q.id]) && (answers[q.id] as string[]).length > 0;
  const needsNext = multi || otherOpen;
  const nextValid = otherOpen ? otherText.trim().length > 0 : multiValid;

  return (
    <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <span className="font-medium text-[11px] text-neutral-400 uppercase tracking-wider">
          {step + 1} of {total}
        </span>
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-neutral-400 text-xs transition-colors hover:text-neutral-700"
        >
          {step === 0 ? (
            "Cancel"
          ) : (
            <>
              <ArrowLeft className="size-3.5" /> Back
            </>
          )}
        </button>
      </div>

      <p className="mt-1 font-medium text-[15px] text-neutral-900">{q.question}</p>

      {q.kind === "schedule" ? (
        <div className="mt-3">
          <SilaSchedulePicker onDone={(cron) => commit({ ...answers, [q.id]: cron })} />
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {q.options.map((opt) => {
            const on = isSelected(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => (multi ? toggleMulti(opt) : pickSingle(opt))}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors",
                  on || picked === opt
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-neutral-200 hover:bg-neutral-50"
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center border",
                    multi ? "rounded" : "rounded-full",
                    on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300"
                  )}
                >
                  {on && <Check className="size-3.5" />}
                </span>
                <span className="text-neutral-800">{opt}</span>
              </button>
            );
          })}

          {q.allow_other && (
            <div
              className={cn(
                "rounded-xl border transition-colors",
                otherOpen ? "border-neutral-900" : "border-neutral-200"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setOtherOpen(true);
                  setPicked(null);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-neutral-500 text-sm hover:bg-neutral-50"
              >
                <Pencil className="size-4 shrink-0 text-neutral-400" />
                Other…
              </button>
              {otherOpen && (
                <div className="border-neutral-100 border-t p-2">
                  <input
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirm();
                    }}
                    placeholder="Type your answer…"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {needsNext && q.kind !== "schedule" && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={!nextValid}
            onClick={confirm}
            className="inline-flex h-9 items-center rounded-lg bg-neutral-950 px-5 font-medium text-sm text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
