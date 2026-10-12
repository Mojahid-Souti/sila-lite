"use client";

import { useStudioSession } from "@/lib/use-n8n-session";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const STYLE_ID = "sila-n8n-readonly";

/**
 * Read-only embed of the REAL n8n canvas for one built workflow (#7).
 *
 * The iframe loads the actual n8n editor through the /n8n proxy with the user's own
 * n8n cookie (minted by useStudioSession). Read-only is enforced on TWO layers:
 *   1. SECURITY (the real boundary): `middleware.ts` 403s every write/execute/activate
 *      under /n8n, so nothing can be saved, run, or published from the browser — the
 *      workflow stays inactive. This holds no matter what the UI does.
 *   2. UX lock (this file): community n8n has no read-only mode, so we make the editor
 *      non-interactive — pan + zoom only — by (a) hiding all chrome and (b) disabling
 *      every edit input path (keyboard shortcuts, right-click menus, drag) at the
 *      capture phase, and making nodes pointer-events:none. Hiding alone wouldn't
 *      disable the capability behind it; the input blocking does.
 */
const READONLY_CSS = `
:root, :root[data-theme="light"], :root[data-theme="dark"] {
  --color-primary: #0a0a0a !important;
  --prim-color-primary: #0a0a0a !important;
  --el-color-primary: #0a0a0a !important;
}
/* Hide every piece of n8n chrome with !important (beats n8n's Vue inline styles),
   using the real n8n 2.20.9 test-ids/classes. Keep ONLY zoom-in / zoom-out. */
.el-notification, .el-message, .el-message-box,
[data-test-id="node-creator"], [data-test-id="node-creator-search-bar"], [class*="node-creator" i],
/* Left rail (AppSidebar) + its items + any sub-sidebar. */
[class*="sidebar" i],
[data-test-id="navigation-menu-item"],
[data-test-id="menu-item"],
/* Breadcrumb + Add-tag. */
[data-test-id="canvas-breadcrumbs"],
[data-test-id="workflow-tags"],
[data-test-id="workflow-tags-container"],
/* Publish / version-history / overflow menu / activate / execute / save. */
[data-test-id="workflow-publish-button"],
[data-test-id="workflow-open-publish-modal-button"],
[data-test-id="auto-publish-select"],
[data-test-id="workflow-menu"],
[data-test-id="workflow-activate-switch"],
[data-test-id="execute-workflow-button"],
[data-test-id="ndv-execute-button"],
[data-test-id="workflow-save-button"],
/* Add-node affordances. */
[data-test-id="canvas-add-button"],
[data-test-id="canvas-add-first-step-button"],
[data-test-id="canvas-handle-plus"],
[data-test-id="canvas-handle-plus-wrapper"],
[data-test-id="canvas-plus-button"],
[data-test-id="node-creator-plus-button"],
[data-test-id="canvas-build-with-ai-button"],
/* Right rail (search, sticky/document, focus panel) + minimap + history clock. */
[data-test-id="focus-panel"],
[data-test-id="toggle-focus-panel-button"],
[data-test-id="canvas-minimap"],
[data-test-id="add-sticky-button"],
[data-test-id="search-bar"],
[data-test-id="canvas-search"],
[data-test-id="workflow-history-button"],
/* Bottom toolbar: drop fit / reset / tidy / undo — keep zoom-in & zoom-out. */
[data-test-id="zoom-to-fit"],
[data-test-id="reset-zoom-button"],
[data-test-id="tidy-up-button"],
[data-test-id="undo-replace-button"],
/* Logs panel. */
[data-test-id="logs-panel"],
[data-test-id="logs-overview"] {
  display: none !important;
}
/* Per-node + per-step run affordances (the trigger ⚡ and the orange "Execute
   workflow" pill on hover) + the canvas search. Match by ACCESSIBLE NAME so it's
   robust to n8n's test-id churn (CSS attribute selectors persist across re-renders). */
[data-test-id="execute-node-button"],
[data-test-id="node-execute-button"],
[data-test-id="canvas-node-toolbar"],
[data-test-id="trigger-execute-button"],
/* The command bar (the magnifier) — its popup exposes Add node / Open node, so hide
   the trigger AND the popup (n8n 2.20.9 test-ids). */
[data-test-id="command-bar-button"],
[data-test-id="command-bar"],
[data-test-id="command-bar-items-list"],
[data-test-id="canvas-search"],
[data-test-id="universal-search"],
button[aria-label="Execute workflow" i],
button[aria-label="Execute step" i],
button[aria-label="Test workflow" i],
button[aria-label="Test step" i],
button[aria-label="Search" i],
button[title="Execute workflow" i],
button[title="Execute step" i],
[aria-label="Search" i][role="button"] {
  display: none !important;
}
/* Nodes are view-only — no NDV, no drag, no handle-pull. The .vue-flow__pane still
   pans (drag passes through) and the wheel/zoom buttons still zoom. */
.vue-flow__node, .vue-flow__handle, .vue-flow__edge { pointer-events: none !important; }
`;

// The view-switcher tabs (Editor/Executions/Evaluations) have no stable test-id.
// Hide the smallest container whose entire text IS those three labels — robust to
// nesting (anchor-walk missed it when the labels weren't a node's exact textContent).
function hideTabBar(doc: Document): void {
  for (const el of doc.querySelectorAll<HTMLElement>("div, nav, ul, header")) {
    const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (
      t.length <= 40 &&
      t.includes("Editor") &&
      t.includes("Executions") &&
      t.includes("Evaluations")
    ) {
      el.style.display = "none";
    }
  }
}

// Belt-and-braces JS hide for run/search affordances, in case n8n labels them by a
// path the CSS attribute selectors miss (re-run on the 400ms interval).
const HIDE_NAMES = new Set([
  "execute workflow",
  "execute step",
  "test workflow",
  "test step",
  "search",
]);
function hideRunChrome(doc: Document): void {
  for (const el of doc.querySelectorAll<HTMLElement>("button, a, [role='button']")) {
    const name = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (HIDE_NAMES.has(name)) el.style.display = "none";
  }
}

/**
 * Disable every editing input path inside the iframe, at the capture phase so n8n's
 * own handlers never see the event. Installed once per window.
 */
function lockInput(doc: Document, win: Window & { __silaLocked?: boolean }): void {
  if (win.__silaLocked) return;
  win.__silaLocked = true;
  const stop = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onKey = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = (e.key || "").toLowerCase();
    // include "k" — Cmd/Ctrl+K opens n8n's command bar (Add node / Open node).
    const editKey = ["a", "c", "v", "x", "z", "y", "s", "d", "k", "enter"].includes(k);
    if (e.key === "Tab" || e.key === "Delete" || e.key === "Backspace" || (mod && editKey)) {
      stop(e);
    }
  };
  doc.addEventListener("keydown", onKey, true);
  doc.addEventListener("contextmenu", stop, true);
  doc.addEventListener("dragstart", stop, true);
}

/**
 * Spotlight the Vue Flow canvas: walk from `.vue-flow` up to <body> and hide every
 * sibling at each level (removes any outer chrome the selector list can't name). The
 * canvas + its zoom controls (children of `.vue-flow`) are untouched.
 */
function isolateCanvas(doc: Document): boolean {
  const canvas = doc.querySelector(".vue-flow");
  if (!canvas) return false;
  let el: Element = canvas;
  while (el !== doc.body) {
    const parent: HTMLElement | null = el.parentElement;
    if (!parent) break;
    for (const sib of Array.from(parent.children)) {
      if (sib !== el && sib instanceof HTMLElement) sib.style.display = "none";
    }
    el = parent;
  }
  return true;
}

type Props = {
  workflowId: string;
  className?: string;
};

export function SilaN8nView({ workflowId, className }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const { state, error, retry } = useStudioSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (state !== "ready") return;
    const iframe = ref.current;
    if (!iframe) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let fallback: ReturnType<typeof setTimeout> | null = null;

    const apply = () => {
      try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow as (Window & { __silaLocked?: boolean }) | null;
        if (!doc?.head || !win) return;
        if (!doc.getElementById(STYLE_ID)) {
          const style = doc.createElement("style");
          style.id = STYLE_ID;
          style.textContent = READONLY_CSS;
          doc.head.appendChild(style);
        }
        lockInput(doc, win);
        hideTabBar(doc);
        hideRunChrome(doc);
        if (isolateCanvas(doc)) setReady(true); // clean reveal once the canvas exists
      } catch {
        // Same-origin via the /n8n proxy, so this shouldn't throw; ignore if it does.
      }
    };

    const onLoad = () => {
      apply();
      // Never get stuck on "Loading…": reveal within 5s of the page loading even if the
      // .vue-flow canvas wasn't detected (n8n's own progress is better than a dead spinner).
      if (!fallback) fallback = setTimeout(() => setReady(true), 5000);
    };

    iframe.addEventListener("load", onLoad);
    interval = setInterval(apply, 400); // n8n re-renders; keep re-applying
    if (iframe.contentDocument?.readyState === "complete") onLoad();

    return () => {
      iframe.removeEventListener("load", onLoad);
      if (interval) clearInterval(interval);
      if (fallback) clearTimeout(fallback);
    };
  }, [state]);

  if (state === "error") {
    return (
      <div
        className={cn(
          "grid size-full place-items-center rounded-xl border border-neutral-200 bg-neutral-50",
          className
        )}
      >
        <div className="flex flex-col items-center gap-3 text-neutral-400 text-sm">
          <span>Couldn't open the workflow view{error ? ` — ${error}` : ""}.</span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-white px-3 font-medium text-neutral-700 text-xs transition-colors hover:bg-neutral-100"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative size-full bg-white", className)}>
      <iframe
        ref={ref}
        title="Workflow (read-only)"
        src={`/n8n/workflow/${workflowId}`}
        className={cn(
          "absolute inset-0 size-full border-0 transition-opacity duration-150",
          ready ? "opacity-100" : "opacity-0"
        )}
      />
      {(state === "minting" || !ready) && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="flex items-center gap-2 text-neutral-400 text-sm">
            <span className="size-2 animate-pulse rounded-full bg-neutral-400" />
            Loading workflow…
          </div>
        </div>
      )}
    </div>
  );
}
