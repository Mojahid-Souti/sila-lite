"use client";

import type { SilaPlanAction } from "@/components/app/sila/sila-trace";
import { SOVEREIGNTY_NOTE } from "@/lib/describe-agent";
import type { SilaPlanArtifact } from "@/lib/sila-socket";
import { cn } from "@/lib/utils";
import { Check, Copy, Download, Hand, Square, Store, X } from "lucide-react";
import { useState } from "react";

/** The plan as real markdown — what Copy puts on the clipboard and Download saves. */
export function planToMarkdown(plan: SilaPlanArtifact): string {
  const lines: string[] = [
    `# ${plan.goal}`,
    "",
    "> Proposal — nothing is built yet.",
    "",
    "## Overview",
    "",
    "| | |",
    "| --- | --- |",
  ];
  const overview: [string, string | undefined][] = [
    ["Type", plan.agentType],
    ["Sources", plan.sources],
    ["Destination", plan.destination],
    ["Connects", plan.integrations?.length ? plan.integrations.join(", ") : undefined],
    ["Schedule", plan.schedule],
  ];
  for (const [label, value] of overview) {
    if (value) lines.push(`| **${label}** | ${value.replaceAll("|", "\\|")} |`);
  }
  if (plan.steps?.length) {
    lines.push("", "## Execution plan", "");
    for (const [i, s] of plan.steps.entries()) {
      const flags = [
        s.parallel ? "runs in parallel" : "",
        s.dependsOn ? `after: ${s.dependsOn}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      lines.push(`${i + 1}. **${s.title}**${flags ? ` _(${flags})_` : ""}`);
      if (s.detail) lines.push(`   ${s.detail}`);
      if (s.input || s.output) lines.push(`   \`${s.input ?? "—"}\` → \`${s.output ?? "—"}\``);
    }
  }
  const settled = settledItems(plan);
  if (settled.length > 0) {
    lines.push("", "## How it will behave", "");
    for (const item of settled) lines.push(`- [x] ${item}`);
  }
  if (plan.risks?.length) {
    lines.push("", "## Risks & fallbacks", "", "| Risk | Fallback |", "| --- | --- |");
    for (const r of plan.risks) {
      lines.push(`| ${r.risk.replaceAll("|", "\\|")} | ${r.fallback.replaceAll("|", "\\|")} |`);
    }
  }
  if (plan.checkpoints?.length) {
    lines.push("", "## Human checkpoints", "");
    for (const c of plan.checkpoints) lines.push(`- [ ] ${c}`);
  }
  if (plan.openDecisions?.length) {
    lines.push("", "## Still to decide", "");
    for (const d of plan.openDecisions) {
      lines.push(`- [ ] ${d.question}${d.options.length ? ` — ${d.options.join(" / ")}` : ""}`);
    }
  }
  if (plan.bazaarMatch) {
    lines.push(
      "",
      "## Ready-made alternative",
      "",
      `You may not need to build this — **${plan.bazaarMatch.name}** already does it` +
        `${plan.bazaarMatch.note ? ` (${plan.bazaarMatch.note})` : ""}.`
    );
  }
  const slots = Object.entries(plan.expertSlots ?? {});
  if (slots.length > 0) {
    lines.push("", "## Technical details", "", "| Slot | Value |", "| --- | --- |");
    for (const [slot, value] of slots) lines.push(`| \`${slot}\` | ${value} |`);
  }
  lines.push("", "---", "", `_${SOVEREIGNTY_NOTE}_`, "");
  return lines.join("\n");
}

function settledItems(plan: SilaPlanArtifact): string[] {
  return [
    plan.content && `Each output: ${plan.content}`,
    plan.fallback && `When the answer isn't in the documents: ${plan.fallback}`,
  ].filter((v): v is string => Boolean(v));
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "plan"
  );
}

/**
 * The plan document — a Claude-artifact-style pane that lives INSIDE the chat
 * canvas (the thread slides left to make room; closing returns it). Header bar:
 * title + MD badge + Copy / Download / close. Body: a monochrome, typographic
 * document (headings, table, check-marked lists). Sticky footer carries
 * Accept & build / Adjust / Discard while the plan is live.
 */
export function SilaPlanDoc({
  plan,
  live,
  onClose,
  onAction,
}: {
  plan: SilaPlanArtifact;
  live: boolean;
  onClose: () => void;
  onAction?: (action: SilaPlanAction) => void;
}) {
  const [copied, setCopied] = useState(false);
  const overviewRows: [string, string | undefined][] = [
    ["Type", plan.agentType],
    ["Sources", plan.sources],
    ["Destination", plan.destination],
    ["Connects", plan.integrations?.length ? plan.integrations.join(", ") : undefined],
    ["Schedule", plan.schedule],
  ];
  const settled = settledItems(plan);
  const expertSlots = Object.entries(plan.expertSlots ?? {});

  const copy = () => {
    void navigator.clipboard.writeText(planToMarkdown(plan)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const download = () => {
    const blob = new Blob([planToMarkdown(plan)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(plan.goal)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-w-0 flex-col border-neutral-200 border-l bg-white">
      {/* Chrome bar — sans, like an artifact viewer. */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-neutral-200 border-b px-4">
        <span className="min-w-0 flex-1 truncate font-medium text-[13px] text-neutral-800">
          {plan.goal}
        </span>
        <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-[10px] text-neutral-500">
          MD
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 font-medium text-[12px] text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={download}
          aria-label="Download as Markdown"
          title="Download as Markdown"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
        >
          <Download className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the plan"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Document body — serif, monochrome, typographic (reads like a proposal). */}
      <article className="sila-scroll min-w-0 flex-1 overflow-y-auto px-8 pt-8 pb-6 font-serif sm:px-10">
        <p className="mb-2 font-medium font-sans text-[11px] text-neutral-400 uppercase tracking-[0.14em]">
          Proposal — nothing is built yet
        </p>
        <h1 className="font-semibold text-[26px] text-neutral-900 leading-snug tracking-tight">
          {plan.goal}
        </h1>

        <h2 className="mt-9 mb-3 border-neutral-200 border-b pb-2 font-semibold text-[19px] text-neutral-900">
          Overview
        </h2>
        <table className="w-full border-collapse text-[14.5px]">
          <tbody>
            {overviewRows.map(
              ([label, value]) =>
                value && (
                  <tr key={label} className="border-neutral-100 border-b last:border-0">
                    <th className="w-36 py-2.5 pr-4 text-left align-top font-semibold text-neutral-500">
                      {label}
                    </th>
                    <td className="py-2.5 text-neutral-800 leading-relaxed">{value}</td>
                  </tr>
                )
            )}
          </tbody>
        </table>

        {plan.steps && plan.steps.length > 0 && (
          <>
            <h2 className="mt-9 mb-3 border-neutral-200 border-b pb-2 font-semibold text-[19px] text-neutral-900">
              Execution plan
            </h2>
            <ol className="space-y-4">
              {plan.steps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-neutral-100 font-sans font-semibold text-[12px] text-neutral-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[15px] text-neutral-900 leading-snug">
                      {s.title}
                      {(s.parallel || s.dependsOn) && (
                        <span className="ml-2 font-sans font-normal text-[11px] text-neutral-400">
                          {[
                            s.parallel ? "runs in parallel" : "",
                            s.dependsOn ? `after: ${s.dependsOn}` : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </p>
                    {s.detail && (
                      <p className="mt-0.5 text-[14px] text-neutral-700 leading-relaxed">
                        {s.detail}
                      </p>
                    )}
                    {(s.input || s.output) && (
                      <p className="mt-1 font-mono text-[11.5px] text-neutral-400">
                        {s.input ?? "—"} <span className="text-neutral-300">→</span>{" "}
                        {s.output ?? "—"}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        {settled.length > 0 && (
          <>
            <h2 className="mt-9 mb-3 border-neutral-200 border-b pb-2 font-semibold text-[19px] text-neutral-900">
              How it will behave
            </h2>
            <ul className="space-y-2.5">
              {settled.map((item) => (
                <li key={item} className="flex gap-2.5 text-[14.5px] leading-relaxed">
                  <Check className="mt-1 size-4 shrink-0 text-neutral-900" />
                  <span className="text-neutral-800">{item}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {plan.risks && plan.risks.length > 0 && (
          <>
            <h2 className="mt-9 mb-3 border-neutral-200 border-b pb-2 font-semibold text-[19px] text-neutral-900">
              Risks &amp; fallbacks
            </h2>
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="border-neutral-200 border-b">
                  <th className="w-[45%] py-2 pr-4 text-left font-semibold text-[13px] text-neutral-500">
                    If this goes wrong
                  </th>
                  <th className="py-2 text-left font-semibold text-[13px] text-neutral-500">
                    The plan falls back to
                  </th>
                </tr>
              </thead>
              <tbody>
                {plan.risks.map((r) => (
                  <tr key={r.risk} className="border-neutral-100 border-b last:border-0">
                    <td className="py-2.5 pr-4 align-top text-neutral-800 leading-relaxed">
                      {r.risk}
                    </td>
                    <td className="py-2.5 align-top text-neutral-700 leading-relaxed">
                      {r.fallback}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {plan.checkpoints && plan.checkpoints.length > 0 && (
          <>
            <h2 className="mt-9 mb-3 border-neutral-200 border-b pb-2 font-semibold text-[19px] text-neutral-900">
              Human checkpoints
            </h2>
            <ul className="space-y-2.5">
              {plan.checkpoints.map((c) => (
                <li key={c} className="flex gap-2.5 text-[14.5px] leading-relaxed">
                  <Hand className="mt-1 size-4 shrink-0 text-neutral-500" />
                  <span className="text-neutral-800">{c}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {plan.openDecisions && plan.openDecisions.length > 0 && (
          <>
            <h2 className="mt-9 mb-3 border-neutral-200 border-b pb-2 font-semibold text-[19px] text-neutral-900">
              Still to decide
            </h2>
            <ul className="space-y-2.5">
              {plan.openDecisions.map((d) => (
                <li key={d.question} className="flex gap-2.5 text-[14.5px] leading-relaxed">
                  <Square className="mt-1 size-4 shrink-0 text-neutral-300" />
                  <span className="text-neutral-800">
                    {d.question}
                    {d.options.length > 0 && (
                      <span className="text-neutral-500"> — {d.options.join(" / ")}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {plan.bazaarMatch && (
          <>
            <h2 className="mt-9 mb-3 border-neutral-200 border-b pb-2 font-semibold text-[19px] text-neutral-900">
              Ready-made alternative
            </h2>
            <div className="flex flex-wrap items-center gap-2.5 text-[14.5px] leading-relaxed">
              <Store className="size-4 shrink-0 text-neutral-500" />
              <p className="min-w-0 flex-1 text-neutral-800">
                You may not need to build this — <b>{plan.bazaarMatch.name}</b> already does it
                {plan.bazaarMatch.note ? ` (${plan.bazaarMatch.note})` : ""}.
              </p>
              {live && onAction && (
                <button
                  type="button"
                  onClick={() => onAction("hire")}
                  className="inline-flex h-7 shrink-0 items-center rounded-lg border border-neutral-300 bg-white px-2.5 font-medium font-sans text-[12px] text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  Use it instead
                </button>
              )}
            </div>
          </>
        )}

        {expertSlots.length > 0 && (
          <>
            <h2 className="mt-9 mb-3 border-neutral-200 border-b pb-2 font-semibold text-[19px] text-neutral-900">
              Technical details
            </h2>
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                {expertSlots.map(([slot, value]) => (
                  <tr key={slot} className="border-neutral-100 border-b last:border-0">
                    <th className="w-36 py-2 pr-4 text-left align-top font-mono font-normal text-[12px] text-neutral-400">
                      {slot}
                    </th>
                    <td className="py-2 text-neutral-700 leading-relaxed">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <hr className="mt-10 border-neutral-200" />
        <p className="mt-3 text-[12px] text-neutral-400 italic leading-relaxed">
          {SOVEREIGNTY_NOTE}
        </p>
      </article>

      {/* Decision footer — the approval point while the plan is live. */}
      <div className="shrink-0 border-neutral-200 border-t bg-white px-5 py-3">
        {live && onAction ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAction("accept")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-200 px-4 font-medium text-[13px] text-neutral-900 transition-colors hover:bg-neutral-300"
            >
              <Check className="size-4" /> Accept &amp; build
            </button>
            <button
              type="button"
              onClick={() => onAction("adjust")}
              className="inline-flex h-9 items-center rounded-lg border border-neutral-300 bg-white px-3.5 font-medium text-[13px] text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Adjust
            </button>
            <button
              type="button"
              onClick={() => onAction("discard")}
              className="inline-flex h-9 items-center rounded-lg px-2.5 font-medium text-[13px] text-neutral-400 transition-colors hover:text-neutral-600"
            >
              Discard
            </button>
            <span className={cn("ml-auto hidden text-[11px] text-neutral-400", "lg:block")}>
              Nothing is built until you accept
            </span>
          </div>
        ) : (
          <p className="text-[12px] text-neutral-400">
            Plan proposed — accepting a plan starts the build, pre-filled with what it settled.
          </p>
        )}
      </div>
    </div>
  );
}
