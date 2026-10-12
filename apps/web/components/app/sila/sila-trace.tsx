"use client";

import { SilaBuildCanvas } from "@/components/app/sila/sila-build-canvas";
import { SilaDashboardBlock } from "@/components/app/sila/sila-dashboard-block";
import { SilaN8nView } from "@/components/app/sila/sila-n8n-view";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectorIcon } from "@/lib/connector-icons";
import { ROUTES } from "@/lib/constants";
import { formatSchedule } from "@/lib/schedule";
import type {
  SilaArtifact,
  SilaCanvasDef,
  SilaDashboard,
  SilaEmailDraft,
  SilaPlanArtifact,
  SilaReadProgress,
  SilaSecurity,
  SilaSegment,
  SilaSource,
  SilaSpecSlot,
  SilaTask,
} from "@/lib/sila-socket";
import { SimpleMarkdown } from "@/lib/simple-markdown";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  Brain,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FileType2,
  Fingerprint,
  Gauge,
  Globe,
  Info,
  Loader,
  Lock,
  type LucideIcon,
  Mail,
  MessagesSquare,
  PanelRight,
  Paperclip,
  Pencil,
  Plug,
  Presentation,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Sparkles,
  Store,
  Table2,
  Upload,
  Workflow,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Process trace — one continuous vertical timeline (a rail down the left runs
 * through every row, steps and text alike), rendered chronologically:
 *
 *   ◉ Loading {model}        (first turn only, while it cold-loads)
 *   │
 *   ◉ Thought for a moment
 *   │  Let me search the Bazaar for that…   (SILA's narration)
 *   │
 *   ◉ Searching the Bazaar   (shimmers + ticks seconds while running)
 *   │
 *   │  I didn't find any HR agents…          (the result)
 *
 * Driven by the socket timeline; the LangGraph orchestrator emits richer
 * worker/progress steps through the same channel.
 */
const TOOL_META: Record<string, { label: string; icon: LucideIcon }> = {
  navigate: { label: "Navigating", icon: ArrowRight },
  search_bazaar: { label: "Searching the Bazaar", icon: Search },
  fetch_url: { label: "Reading the page", icon: Globe },
  web_search: { label: "Searching the web", icon: Search },
  read_outlook_emails: { label: "Reading your inbox", icon: Mail },
  read_email_attachments: { label: "Reading the attachments", icon: Paperclip },
  read_teams_messages: { label: "Reading the Teams channel", icon: MessagesSquare },
  confirm_send_email: { label: "Sending the email", icon: Mail },
  create_grafana_dashboard: { label: "Building the dashboard", icon: BarChart3 },
  create_slide_deck: { label: "Building the slide deck", icon: PanelRight },
  hire_agent: { label: "Hiring the agent", icon: Store },
  create_agent_from_docs: { label: "Building the agent", icon: Sparkles },
  create_agent_workflow: { label: "Building the agent", icon: Sparkles },
  create_workflow_draft: { label: "Drafting the workflow", icon: Workflow },
  propose_plan: { label: "Drafting the plan", icon: ClipboardList },
  upload: { label: "Reading your documents", icon: Upload },
  generate_preview: { label: "Generating a sample preview", icon: Eye },
  register_mcp_server: { label: "Connecting the tool", icon: Plug },
  // Security review (Phase-6 gatekeeper) steps — stable ids from the vetting node.
  security_review: { label: "Security review", icon: ShieldCheck },
  pii: { label: "Checking for sensitive data", icon: Fingerprint },
  prompt_injection: { label: "Checking the prompt for manipulation", icon: ShieldAlert },
  llm_review: { label: "Reviewing with the safety model", icon: Brain },
  workflow_rules: { label: "Checking tools & data access", icon: Lock },
};

function humanize(name: string): string {
  const s = name.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function metaFor(name: string): { label: string; icon: LucideIcon } {
  // A registered MCP tool, `mcp__<server>__<tool>` — show "Using <tool> via
  // <server>" instead of the raw namespaced id.
  if (name.startsWith("mcp__")) {
    const [, server, ...rest] = name.split("__");
    const tool = rest.join(" ").replace(/[-_]/g, " ").trim();
    const srv = (server ?? "").replace(/[-_]/g, " ").trim();
    return { label: `Using ${tool || "a tool"} via ${srv || "a connected server"}`, icon: Plug };
  }
  return TOOL_META[name] ?? { label: humanize(name), icon: Wrench };
}

type StepRow = {
  kind: "step";
  key: string;
  label: string;
  icon: LucideIcon;
  running: boolean;
  result?: string;
  note?: string; // live stage text while running ("Designing the layout…")
  name?: string;
  sources?: SilaSource[];
  artifacts?: SilaArtifact[];
  tasks?: SilaTask[];
  /** A counted read — rendered as a percentage and a scrolling list. */
  progress?: SilaReadProgress;
};
/** What a turn produced, rendered under the message like a mail attachment —
 *  not as a trace step. The build card used to sit wherever the tool happened
 *  to run, mid-reasoning, which is not where you look for the thing you asked
 *  for. */
/** Icon and type label per artifact kind. Kept next to the renderer so adding a
 *  kind is one edit, not a hunt through conditionals. */
const ARTIFACT_META: Record<
  SilaArtifact["kind"],
  { icon: LucideIcon; label: string; tone: string }
> = {
  agent: { icon: Bot, label: "Agent", tone: "text-primary" },
  deck: { icon: Presentation, label: "Slides", tone: "text-orange-600" },
  doc: { icon: FileText, label: "Document", tone: "text-blue-600" },
  sheet: { icon: Table2, label: "Sheet", tone: "text-emerald-600" },
  pdf: { icon: FileType2, label: "PDF", tone: "text-red-600" },
  dashboard: { icon: BarChart3, label: "Dashboard", tone: "text-violet-600" },
  grafana: { icon: Gauge, label: "Grafana", tone: "text-orange-600" },
};

const ARTIFACT_TILE =
  "group flex h-28 w-36 shrink-0 flex-col rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50";

/** The face of one attachment tile. A component rather than a fragment built
 *  inside the map, so its children are not treated as an unkeyed list. */
/** Why a card is blocked (or flagged), on hover. One line per finding, with the
 *  location first because that is what the user will act on. */
function GatewayInfo({ security }: { security: SilaSecurity }) {
  const blocked = security.status === "blocked";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A button, so it is reachable by keyboard and the tooltip opens on
            focus as well as hover. The click is swallowed so a tile that IS
            openable (a notice) does not also open when the icon is pressed. */}
        <button
          type="button"
          aria-label={blocked ? "Blocked by the security gateway" : "Security notice"}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-md",
            blocked ? "text-red-600" : "text-amber-600"
          )}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        <p className="mb-1 font-semibold text-[12px]">
          {blocked ? "Blocked by the security gateway" : "Security notice"}
        </p>
        <ul className="space-y-0.5 text-[11.5px] leading-snug">
          {security.findings.map((f) => (
            <li key={`${f.location}-${f.type}-${f.preview}`}>
              <span className="font-medium">{f.location}:</span> {f.label}{" "}
              <span className="font-mono opacity-80">{f.preview}</span>
            </li>
          ))}
        </ul>
        {blocked && (
          <p className="mt-1.5 text-[11px] opacity-80">
            Ask SILA to edit it — it will point at each place and regenerate.
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/** Grafana's own mark, drawn inline. A generic chart glyph makes the reader
 *  guess which tool the card opens, and the point of a card is that they
 *  recognise it and click. Drawn rather than fetched: an external logo URL is a
 *  request off-box on a platform whose claim is that nothing leaves. */
function GrafanaMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none">
      <title>Grafana</title>
      <path
        d="M12 2.5 4 6.7v6.4c0 4.2 3.3 7.5 8 8.4 4.7-.9 8-4.2 8-8.4V6.7L12 2.5Z"
        stroke="#F46800"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.3 14.6l2.3-3 1.9 1.8 2.9-4"
        stroke="#F46800"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArtifactFace({
  art,
  linked,
  downloadUrl,
}: { art: SilaArtifact; linked: boolean; downloadUrl?: string | null }) {
  const meta = ARTIFACT_META[art.kind] ?? ARTIFACT_META.doc;
  const Icon = meta.icon;
  const marks = (art.integrations ?? []).slice(0, 2);
  const gate = art.security?.status ?? "clear";
  const blocked = gate === "blocked";
  return (
    <>
      <span className="mb-1.5 flex items-center justify-between gap-1">
        <span className="flex items-center gap-1">
          {blocked ? (
            <ShieldX className="size-4 text-red-600" />
          ) : art.kind === "grafana" ? (
            <GrafanaMark />
          ) : marks.length > 0 ? (
            marks.map((m) => <ConnectorIcon key={m} name={m} className="size-4" />)
          ) : art.kind === "agent" && art.web ? (
            <Globe className="size-4 text-neutral-500" />
          ) : (
            <Icon className={cn("size-4", meta.tone)} />
          )}
        </span>
        {art.security && gate !== "clear" && <GatewayInfo security={art.security} />}
      </span>
      <span
        className={cn(
          "line-clamp-2 font-medium text-[12px] leading-snug [overflow-wrap:anywhere]",
          blocked ? "text-red-900" : "text-neutral-800"
        )}
      >
        {art.name}
      </span>
      <span className="mt-auto flex shrink-0 items-center justify-between gap-1">
        <span
          className={cn(
            "inline-flex items-center rounded-md px-1.5 py-0.5 font-bold text-[9px] uppercase tracking-wide",
            blocked ? "bg-red-100 text-red-700" : "bg-neutral-100 text-neutral-600"
          )}
        >
          {blocked ? "Blocked" : art.kind === "agent" ? "Draft" : meta.label}
        </span>
        {linked && downloadUrl ? (
          // Inside the tile's button, so the click must not also open the pane.
          <a
            href={downloadUrl}
            download
            onClick={(e) => e.stopPropagation()}
            title={`Download ${art.name}`}
            className="grid size-6 shrink-0 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-800 group-hover:bg-neutral-100 group-hover:text-neutral-700"
          >
            <Download className="size-4" />
          </a>
        ) : linked ? (
          <span
            title={art.kind === "agent" ? "Open" : "Download"}
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-md text-neutral-400 transition-colors group-hover:bg-neutral-100 group-hover:text-neutral-700"
          >
            {art.kind === "agent" ? (
              <ArrowUpRight className="size-4" />
            ) : (
              <Download className="size-4" />
            )}
          </span>
        ) : null}
      </span>
    </>
  );
}

/** The turn's task list, pinned above the trace.
 *
 *  A long request is where the tail gets dropped — "search, table it, chart it,
 *  then push a dashboard" becomes three of four. Showing the list, and ticking
 *  it as each step lands, makes the missing one visible to BOTH the reader and
 *  the model, which re-reads it on every step. */
function TaskList({ tasks }: { tasks: SilaTask[] }) {
  const done = tasks.filter((t) => t.done).length;
  return (
    <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50/70 px-3.5 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-medium text-[12px] text-neutral-600">Plan</span>
        <span className="text-[11px] text-neutral-400 tabular-nums">
          {done}/{tasks.length}
        </span>
      </div>
      <ol className="space-y-1">
        {tasks.map((task) => (
          <li key={task.title} className="flex items-start gap-2 text-[12.5px]">
            <span
              className={cn(
                "mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-full border",
                task.done ? "border-primary bg-primary text-white" : "border-neutral-300"
              )}
            >
              {task.done && <Check className="size-2.5" />}
            </span>
            <span className={task.done ? "text-neutral-400 line-through" : "text-neutral-700"}>
              {task.title}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** What a turn produced, rendered under the message like mail attachments.
 *  Every kind uses the same tile so a deck, a document and an agent read as one
 *  family of "here is the thing you asked for". */
function AttachmentStrip({
  rows,
  onOpen,
}: {
  rows: StepRow[];
  onOpen?: (art: SilaArtifact) => void;
}) {
  const artifacts = rows.flatMap((r) => r.artifacts ?? []);
  if (artifacts.length === 0) return null;
  const blocked = artifacts.filter((a) => a.security?.status === "blocked");
  const blockedCount = blocked.length;
  // A scan that could not RUN is held back as a precaution — saying it
  // "contains personal data" would be a false accusation about the file.
  const scanFailed = blocked.some((a) =>
    a.security?.findings?.some((f) => f.type === "scan.failed")
  );
  return (
    <TooltipProvider delayDuration={150}>
      {blockedCount > 0 && (
        // The verdict, in red, above the cards it applies to. The model says the
        // same in prose; this is the part that stays visible after the scroll.
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] text-red-800">
          <ShieldX className="mt-0.5 size-4 shrink-0 text-red-600" />
          <span>
            <span className="font-semibold">Security gateway:</span>{" "}
            {scanFailed ? (
              <>
                the check could not complete on {blockedCount}{" "}
                {blockedCount === 1 ? "item" : "items"}, so{" "}
                {blockedCount === 1 ? "it is" : "they are"} locked as a precaution — nothing was
                found in {blockedCount === 1 ? "it" : "them"}. Ask SILA to try again.
              </>
            ) : (
              <>
                {blockedCount} {blockedCount === 1 ? "item contains" : "items contain"} personal
                data and cannot be opened until it is removed. Hover the{" "}
                <Info className="inline size-3.5 align-text-bottom" /> for where, or ask SILA to
                edit it.
              </>
            )}
          </span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {artifacts.map((art, i) => {
          const key = `${art.kind}-${art.id ?? art.url ?? i}`;
          // A blocked card is a card you cannot click: no link, no button, no
          // download. The face still explains itself on hover.
          if (art.security?.status === "blocked") {
            return (
              <div
                key={key}
                aria-disabled
                title={
                  art.security?.findings?.some((f) => f.type === "scan.failed")
                    ? "Locked: the security scan could not complete"
                    : "Blocked by the security gateway"
                }
                className={cn(
                  ARTIFACT_TILE,
                  "cursor-not-allowed border-red-200 bg-red-50/60 hover:border-red-200 hover:bg-red-50/60"
                )}
              >
                <ArtifactFace art={art} linked={false} />
              </div>
            );
          }
          // Grafana lives outside Sila, so its card opens the dashboard in a new
          // tab rather than the local preview pane.
          if (art.kind === "grafana" && art.url) {
            return (
              <a
                key={key}
                href={art.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${art.name} in Grafana`}
                className={ARTIFACT_TILE}
              >
                <ArtifactFace art={art} linked />
              </a>
            );
          }
          // An agent routes internally — there is nothing to preview, so its tile
          // stays a link to the agent itself.
          if (art.kind === "agent") {
            return (
              <Link
                key={key}
                href={ROUTES.myAgents}
                title={`Open ${art.name}`}
                className={ARTIFACT_TILE}
              >
                <ArtifactFace art={art} linked />
              </Link>
            );
          }
          // A file opens the preview pane; the corner icon downloads it outright,
          // so "look first" and "just give me the file" are one click each.
          return art.url && onOpen ? (
            <button
              key={key}
              type="button"
              onClick={() => onOpen(art)}
              title={`Preview ${art.name}`}
              className={cn(ARTIFACT_TILE, "text-left")}
            >
              <ArtifactFace art={art} linked downloadUrl={art.url} />
            </button>
          ) : (
            <div key={key} className={ARTIFACT_TILE}>
              <ArtifactFace art={art} linked={false} />
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/** A counted read — an inbox, a channel — as a percentage and a list that grows
 *  item by item, the way the web-search step lists its sources. Newest at the
 *  bottom while running; the whole list, scrollable, once done. */
function ReadingList({ progress, running }: { progress: SilaReadProgress; running: boolean }) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const shown = running ? progress.items.slice(-6) : progress.items;
  return (
    <div className="mt-1.5 w-full max-w-md">
      <div className="mb-1 flex items-center gap-2">
        <span
          className={cn("text-[12px] tabular-nums", running ? "sila-shimmer" : "text-neutral-500")}
        >
          {running ? "Reading" : "Read"} {progress.done} of {progress.total} · {pct}%
        </span>
        <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-200">
          <span
            className={cn(
              "block h-full rounded-full transition-[width] duration-300",
              running ? "bg-neutral-700" : "bg-neutral-400"
            )}
            style={{ width: `${pct}%` }}
          />
        </span>
      </div>
      <ul
        className={cn(
          "space-y-0.5 rounded-xl border border-neutral-200 bg-white p-1.5",
          running ? "overflow-hidden" : "sila-scroll max-h-44 overflow-y-auto"
        )}
      >
        {shown.map((item, i) => (
          <li
            // Position is part of the identity: items only ever append.
            key={`${i}-${item.title}`}
            className="sila-read-in flex items-center gap-2 rounded-lg px-2 py-1"
          >
            <span className="grid size-3.5 shrink-0 place-items-center rounded-sm bg-neutral-200 font-semibold text-[8px] text-neutral-600">
              {(item.meta || item.title || "?").charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-700">
              {item.title}
            </span>
            {item.meta && (
              <span className="max-w-[40%] shrink-0 truncate text-[11px] text-neutral-400">
                {item.meta}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A source's own favicon, with a letter badge when it can't be fetched. */
function SourceIcon({ domain, url }: { domain?: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const host =
    domain ||
    (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();
  if (failed || !host) {
    return (
      <span className="grid size-3.5 shrink-0 place-items-center rounded-sm bg-neutral-200 font-semibold text-[8px] text-neutral-600">
        {(host || "?").charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={`https://${host}/favicon.ico`}
      alt=""
      aria-hidden
      loading="lazy"
      className="size-3.5 shrink-0 rounded-sm object-contain"
      onError={() => setFailed(true)}
    />
  );
}

type TextRow = { kind: "text"; key: string; text: string };
type ThinkingRow = { kind: "thinking"; key: string; text: string };
type CanvasRow = {
  kind: "canvas";
  key: string;
  workflowId?: string;
  definition?: SilaCanvasDef;
};
type PreviewRow = {
  kind: "preview";
  key: string;
  variant?: string; // "confirm" = the reflected spec block (no dry-run sample)
  output: string;
  destination?: string | null;
  spec?: string;
  specSlots?: SilaSpecSlot[];
  requestId?: string;
};
type PlanRow = { kind: "plan"; key: string; plan: SilaPlanArtifact; requestId?: string };
type DashboardRow = { kind: "dashboard"; key: string; dashboard: SilaDashboard };
type EmailRow = { kind: "email"; key: string; draft: SilaEmailDraft; requestId?: string };
/** The task checklist, rendered where it was published. Re-published on every
 *  update, so the reader watches it tick rather than finding it only at the top. */
type TasksRow = { kind: "tasks"; key: string; tasks: SilaTask[] };

type Row =
  | TasksRow
  | StepRow
  | TextRow
  | ThinkingRow
  | CanvasRow
  | PreviewRow
  | PlanRow
  | DashboardRow
  | EmailRow;

/** What the user did with a live plan card. */
export type SilaPlanAction = "accept" | "adjust" | "discard" | "hire";

export function SilaTrace({
  timeline,
  thinking,
  model,
  activeAskId,
  onConfirm,
  onAdjust,
  onOpenPlan,
  activeEmailId,
  onEmailConfirm,
  collapsible,
  settled,
  onOpenArtifact,
}: {
  timeline: SilaSegment[];
  thinking: boolean;
  model?: string;
  // The pending confirm's request id + a callback — when a preview carries this id, it
  // renders Accept/Adjust itself (accept-in-preview).
  activeAskId?: string;
  onConfirm?: (requestId: string, accept: boolean) => void;
  // Save the preview card's inline spec edits (slot id -> new value).
  onAdjust?: (requestId: string, values: Record<string, string>) => void;
  // Open the plan document (the side panel); decisions happen there.
  onOpenPlan?: (plan: SilaPlanArtifact, requestId?: string) => void;
  // The pending email confirm's request id + Send/Cancel callback — the email
  // card shows its buttons only while it carries this id (read-only otherwise).
  activeEmailId?: string;
  onEmailConfirm?: (requestId: string, confirmed: boolean) => void;
  // A finished (past) turn collapses its reasoning steps under a toggle.
  collapsible?: boolean;
  /** The socket has gone idle — the turn is genuinely over, text included.
   *  A LIVE message stays live until the user sends the next one, so this is
   *  the only signal that says "done" while the reply is still the live row. */
  settled?: boolean;
  /** Open a generated file in the side pane. Absent = the tiles stay
   *  download-only, which is what a rendered-elsewhere trace wants. */
  onOpenArtifact?: (art: SilaArtifact) => void;
}) {
  const startRef = useRef<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const thinkingRunning = thinking && timeline.length === 0;
  const rows: Row[] = [];

  // Leading steps: while still thinking, one running step; once output starts (or
  // on a past message), the settled "Loading {model}" (turn 1) + "Thought for a
  // moment". `model` is only supplied on the first turn.
  if (thinkingRunning) {
    rows.push({
      kind: "step",
      key: "think",
      label: model ? `Loading ${model}` : "Thinking",
      icon: model ? Loader : Brain,
      running: true,
    });
  } else {
    if (model) {
      rows.push({
        kind: "step",
        key: "load",
        label: `Loading ${model}`,
        icon: Loader,
        running: false,
      });
    }
    rows.push({
      kind: "step",
      key: "thought",
      label: "Thought for a moment",
      icon: Brain,
      running: false,
    });
  }

  // Collapse consecutive same-name tool steps (e.g. two back-to-back searches).
  // The later run wins for status and result, but anything PRODUCED is carried
  // forward: a tool that succeeded and then ran again would otherwise take its
  // artifacts and citations with it (the deck retried twice before succeeding).
  const merged: SilaSegment[] = [];
  for (const seg of timeline) {
    const last = merged.at(-1);
    if (seg.type === "tool" && last?.type === "tool" && last.name === seg.name) {
      merged[merged.length - 1] = {
        ...seg,
        artifacts: seg.artifacts ?? last.artifacts,
        sources: seg.sources ?? last.sources,
        tasks: seg.tasks ?? last.tasks,
        progress: seg.progress ?? last.progress,
      };
    } else {
      merged.push(seg);
    }
  }
  for (const [i, seg] of merged.entries()) {
    if (seg.type === "text") {
      if (seg.text.trim()) rows.push({ kind: "text", key: `text-${i}`, text: seg.text });
    } else if (seg.type === "thinking") {
      if (seg.text.trim()) rows.push({ kind: "thinking", key: `think-${i}`, text: seg.text });
    } else if (seg.type === "canvas") {
      rows.push({
        kind: "canvas",
        key: `canvas-${i}`,
        workflowId: seg.workflowId,
        definition: seg.definition,
      });
    } else if (seg.type === "preview") {
      rows.push({
        kind: "preview",
        key: `preview-${i}`,
        variant: seg.kind,
        output: seg.output,
        destination: seg.destination,
        spec: seg.spec,
        specSlots: seg.specSlots,
        requestId: seg.requestId,
      });
    } else if (seg.type === "plan") {
      rows.push({ kind: "plan", key: `plan-${i}`, plan: seg.plan, requestId: seg.requestId });
    } else if (seg.type === "dashboard") {
      rows.push({ kind: "dashboard", key: `dash-${i}`, dashboard: seg.dashboard });
    } else if (seg.type === "email") {
      rows.push({ kind: "email", key: `email-${i}`, draft: seg.draft, requestId: seg.requestId });
    } else {
      const m = metaFor(seg.name);
      rows.push({
        kind: "step",
        key: `${seg.name}-${i}`,
        label: m.label,
        icon: m.icon,
        running: seg.status === "running",
        result: seg.result,
        note: seg.note,
        name: seg.name,
        sources: seg.sources,
        artifacts: seg.artifacts,
        tasks: seg.tasks,
        progress: seg.progress,
      });
      if (seg.name === "track_tasks" && seg.tasks?.length) {
        // The checklist IS the output of this step, so it takes the row rather
        // than sitting under a "Track tasks — 2/4 done" line that says the same
        // thing less clearly.
        rows[rows.length - 1] = {
          kind: "tasks",
          key: `tasks-${rows.length}`,
          tasks: seg.tasks,
        };
      }
    }
  }

  // Drop stamps for rows that no longer exist FIRST. Keys are `${name}-${index}`
  // within the current turn, and the timeline resets to index 0 every turn — so
  // without this a new turn's first search reuses the stamp from the last turn's
  // first search and reports the age of the whole session. That is how a search
  // that really takes ~20s displayed 904s and kept climbing.
  const liveKeys = new Set(rows.map((r) => r.key));
  for (const key of Object.keys(startRef.current)) {
    if (!liveKeys.has(key)) delete startRef.current[key];
  }
  // Stamp each step's start the first time it runs; tick while anything runs.
  for (const r of rows) {
    if (r.kind === "step" && r.running && !startRef.current[r.key]) {
      startRef.current[r.key] = Date.now();
    }
  }
  const anyRunning = rows.some((r) => r.kind === "step" && r.running);
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [anyRunning]);

  const renderRow = (row: Row, isLast: boolean) => (
    <div key={row.key} className="sila-trace-row flex gap-2.5">
      {/* Rail: a centered icon (steps / canvas) and the connecting line. */}
      <div className="flex w-5 shrink-0 flex-col items-center">
        {row.kind !== "text" && (
          <span className="grid size-5 shrink-0 place-items-center text-neutral-400">
            {row.kind === "canvas" ? (
              <Workflow className="size-3.5" />
            ) : row.kind === "tasks" ? (
              <ClipboardList className="size-3.5" />
            ) : row.kind === "preview" ? (
              <Eye className="size-3.5" />
            ) : row.kind === "plan" ? (
              <ClipboardList className="size-3.5" />
            ) : row.kind === "thinking" ? (
              <Brain className="size-3.5" />
            ) : row.kind === "dashboard" ? (
              <BarChart3 className="size-3.5" />
            ) : row.kind === "email" ? (
              <Mail className="size-3.5" />
            ) : row.running ? (
              <Loader className="size-3.5 animate-spin" />
            ) : (
              <row.icon className="size-3.5" />
            )}
          </span>
        )}
        {!isLast && <span className="w-px flex-1 bg-neutral-200" />}
      </div>
      {/* Content: a step label, a paragraph, or an inline block (workflow / preview). */}
      {row.kind === "canvas" ? (
        <CanvasBlock workflowId={row.workflowId} definition={row.definition} />
      ) : row.kind === "dashboard" ? (
        <SilaDashboardBlock dashboard={row.dashboard} />
      ) : row.kind === "email" ? (
        <EmailDraftBlock
          draft={row.draft}
          live={Boolean(row.requestId && row.requestId === activeEmailId)}
          onConfirm={
            row.requestId && onEmailConfirm
              ? (confirmed) => onEmailConfirm(row.requestId as string, confirmed)
              : undefined
          }
        />
      ) : row.kind === "tasks" ? (
        <div className="min-w-0 flex-1 pb-2">
          <TaskList tasks={row.tasks} />
        </div>
      ) : row.kind === "plan" ? (
        <PlanBlock
          plan={row.plan}
          live={Boolean(row.requestId && row.requestId === activeAskId)}
          onOpen={onOpenPlan ? () => onOpenPlan(row.plan, row.requestId) : undefined}
        />
      ) : row.kind === "preview" ? (
        <PreviewBlock
          variant={row.variant}
          output={row.output}
          destination={row.destination}
          spec={row.spec}
          specSlots={row.specSlots}
          live={Boolean(row.requestId && row.requestId === activeAskId)}
          onConfirm={
            row.requestId && onConfirm
              ? (accept) => onConfirm(row.requestId as string, accept)
              : undefined
          }
          onAdjust={
            row.requestId && onAdjust
              ? (values) => onAdjust(row.requestId as string, values)
              : undefined
          }
        />
      ) : row.kind === "step" ? (
        <div className="flex min-w-0 flex-1 flex-col pb-2 text-[13px]">
          <span className="flex items-center gap-1.5">
            <span className={cn(row.running ? "sila-shimmer" : "text-neutral-400")}>
              {row.label}
            </span>
            {row.running &&
              (() => {
                const elapsed = Math.floor((now - (startRef.current[row.key] ?? now)) / 1000);
                // The counter is the proof of life. It used to be neutral-300 —
                // nearly invisible — so a step that genuinely takes 30s+ (the
                // hosted model re-runs searches) read as frozen. It darkens once
                // a step is slow enough that someone would start to wonder.
                return elapsed > 0 ? (
                  <span
                    className={cn(
                      "text-[11px] tabular-nums transition-colors",
                      elapsed >= 8 ? "text-neutral-500" : "text-neutral-400"
                    )}
                  >
                    {elapsed}s
                  </span>
                ) : null;
              })()}
          </span>
          {row.progress ? (
            <ReadingList progress={row.progress} running={row.running} />
          ) : row.running && row.note ? (
            <span className="sila-shimmer mt-0.5 text-[12px]">{row.note}</span>
          ) : (
            row.running &&
            (() => {
              // A step with no progress note of its own still has to look alive.
              // "Set objective" sat with a bare grey label and nothing moving.
              const elapsed = Math.floor((now - (startRef.current[row.key] ?? now)) / 1000);
              return elapsed >= 8 ? (
                <span className="sila-shimmer mt-0.5 text-[12px]">
                  Still working — this step is taking a while
                </span>
              ) : null;
            })()
          )}
          {/* A counted read already says "Read 2 of 2" in its own header; the
              step's one-line result ("Read 2 emails") would say it again. */}
          {!row.running && row.result && !row.progress && (
            <span className="mt-0.5 text-[12px] text-neutral-400">{row.result}</span>
          )}
          {!row.running && row.sources && row.sources.length > 0 && (
            // What the answer was actually based on. Rendered from the step's own
            // data, so it appears whether or not the model mentioned the links.
            <ul className="mt-1.5 space-y-0.5 rounded-xl border border-neutral-200 bg-white p-1.5">
              {row.sources.map((src) => (
                <li key={src.url}>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-neutral-50"
                  >
                    {/* The SOURCE's own favicon, not an aggregator's. The obvious
                        choice (google.com/s2/favicons) would tell Google every
                        domain a user browses inside SILA — a tracking beacon on a
                        platform whose whole claim is that data stays put. Falling
                        back to a letter badge keeps the row aligned when a site
                        has no icon or blocks the request. */}
                    <SourceIcon domain={src.domain} url={src.url} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-700">
                      {src.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-400">{src.domain}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : row.kind === "thinking" ? (
        <div className="min-w-0 flex-1 whitespace-pre-wrap pb-2 text-[13px] italic leading-relaxed text-neutral-400">
          {row.text}
        </div>
      ) : (
        <div className="sila-prose min-w-0 flex-1 pb-2 text-neutral-800">
          <SimpleMarkdown text={row.text} />
        </div>
      )}
    </div>
  );

  // A finished turn (not live) collapses its reasoning — the step chips (thinking +
  // tool runs) hide under a "Thought it through" toggle; the answer + artifacts
  // (text/canvas/preview/plan) stay visible. Live turns stream everything inline.
  if (collapsible && !thinking) {
    // Three buckets, not two.
    //
    // SOURCES are evidence for the answer and read above it, where a citation
    // list belongs. ATTACHMENTS — the agent a build produced — go at the very
    // END, under the message, the way a mail client puts a file beneath the
    // body rather than wherever it happened to be generated. Everything else
    // collapses under "Thought it through" as before.
    const isSources = (r: Row) => r.kind === "step" && (r.sources?.length ?? 0) > 0;
    const isAttachment = (r: Row) => r.kind === "step" && (r.artifacts?.length ?? 0) > 0;
    const stepRows = rows.filter(
      (r) => (r.kind === "step" || r.kind === "thinking") && !isSources(r) && !isAttachment(r)
    );
    const contentRows = rows.filter(
      (r) => ((r.kind !== "step" && r.kind !== "thinking") || isSources(r)) && !isAttachment(r)
    );
    const attachmentRows = rows.filter(isAttachment);
    // Only offer the toggle when there's real reasoning behind it — an actual
    // tool step (has `name`) or streamed thinking text. Expanding to just the
    // "Thought for a moment" chip reads as "nothing happened".
    const substantive = stepRows.some(
      (r) => r.kind === "thinking" || (r.kind === "step" && r.name)
    );
    return (
      <div>
        {stepRows.length > 0 && substantive && (
          <div className="mb-1.5">
            <button
              type="button"
              onClick={() => setReasoningOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md py-0.5 text-[12.5px] text-neutral-400 transition-colors hover:text-neutral-600"
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform", reasoningOpen ? "" : "-rotate-90")}
              />
              {reasoningOpen ? "Hide reasoning" : "Thought it through"}
            </button>
            {reasoningOpen && (
              <div className="mt-1.5 border-neutral-100 border-l pl-3">
                {stepRows.map((row, i) => renderRow(row, i === stepRows.length - 1))}
              </div>
            )}
          </div>
        )}
        {contentRows.map((row, i) => renderRow(row, i === contentRows.length - 1))}
        <AttachmentStrip rows={attachmentRows as StepRow[]} onOpen={onOpenArtifact} />
      </div>
    );
  }

  // Live path. The last reply of a turn STAYS live until the user sends the
  // next message, so "render attachments only once it becomes a normal message"
  // meant they never appeared at all. `settled` is the socket going idle: the
  // tools have finished AND the closing text has stopped streaming, which is
  // what "no step is running" failed to capture on its own.
  const liveAttachments = settled
    ? rows.filter((r) => r.kind === "step" && (r.artifacts?.length ?? 0) > 0)
    : [];
  const liveRest = settled
    ? rows.filter((r) => !(r.kind === "step" && (r.artifacts?.length ?? 0) > 0))
    : rows;
  // A busy turn with no open step showed NOTHING — the gap between SILA's
  // opening line and its first tool call read as a hang, with only the Stop
  // button hinting it was alive. This keeps a heartbeat on screen for it.
  const idleGap = !settled && !rows.some((r) => r.kind === "step" && r.running) && rows.length > 0;
  return (
    <div>
      {liveRest.map((row, i) => renderRow(row, i === liveRest.length - 1))}
      {idleGap && (
        <div className="flex items-start gap-2.5 pb-2">
          <span className="grid size-5 shrink-0 place-items-center text-neutral-300">
            <Loader className="size-3.5 animate-spin" />
          </span>
          <span className="sila-shimmer text-[13px]">Working…</span>
        </div>
      )}
      <AttachmentStrip rows={liveAttachments as StepRow[]} onOpen={onOpenArtifact} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline blocks — the plan card, the dry-run preview, and the workflow canvas
// share ONE visual language: a rounded card with a tinted header strip (icon +
// title + status pill), hairline-divided body sections, and a footer strip for
// actions/hints. The accent carries the mode color (Plan = blue); everything
// else stays neutral. Don't hand-roll a fourth variant — use InlineBlock.
// ---------------------------------------------------------------------------
type BlockAccent = "neutral" | "blue";

const BLOCK_STYLES: Record<
  BlockAccent,
  { border: string; headBorder: string; headBg: string; icon: string; pillRing: string }
> = {
  neutral: {
    border: "border-neutral-200",
    headBorder: "border-neutral-100",
    headBg: "bg-neutral-50/70",
    icon: "text-neutral-500",
    pillRing: "ring-neutral-200",
  },
  blue: {
    border: "border-blue-200",
    headBorder: "border-blue-100",
    headBg: "bg-blue-50/60",
    icon: "text-blue-500",
    pillRing: "ring-blue-100",
  },
};

function InlineBlock({
  accent = "neutral",
  icon: Icon,
  title,
  pill,
  pillClass,
  onHeaderClick,
  headerExpanded,
  children,
}: {
  accent?: BlockAccent;
  icon: LucideIcon;
  title: string;
  pill?: string;
  /** Overrides the default white/gray pill (e.g. the amber Draft state). */
  pillClass?: string;
  /** When set, the header is a collapse/expand toggle (chevron included). */
  onHeaderClick?: () => void;
  headerExpanded?: boolean;
  children: React.ReactNode;
}) {
  const s = BLOCK_STYLES[accent];
  const hasBody = children !== null && children !== undefined && children !== false;
  const headerContent = (
    <>
      <Icon className={cn("size-4 shrink-0", s.icon)} />
      <span className="font-medium text-[13px] text-neutral-800">{title}</span>
      {pill && (
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2 py-0.5 font-medium text-[10px]",
            pillClass ?? cn("bg-white text-neutral-500 ring-1", s.pillRing)
          )}
        >
          {pill}
        </span>
      )}
      {onHeaderClick && (
        <ChevronDown
          className={cn(
            "shrink-0 text-neutral-400 transition-transform",
            pill ? "size-4" : "ml-auto size-4",
            headerExpanded && "rotate-180"
          )}
        />
      )}
    </>
  );
  return (
    <div className="min-w-0 flex-1 pb-2">
      <div className={cn("overflow-hidden rounded-xl border bg-white shadow-sm", s.border)}>
        {onHeaderClick ? (
          <button
            type="button"
            onClick={onHeaderClick}
            aria-expanded={headerExpanded}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:brightness-[0.98]",
              hasBody && cn("border-b", s.headBorder),
              s.headBg
            )}
          >
            {headerContent}
          </button>
        ) : (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-2",
              hasBody && cn("border-b", s.headBorder),
              s.headBg
            )}
          >
            {headerContent}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * The plan artifact's compact in-chat presence — the full plan opens FROM THE SIDE
 * as a document (SilaPlanDoc). One line of goal + the open affordance; while the
 * decision is live the button is the emphasized entry point to Accept/Adjust/Discard.
 */
function PlanBlock({
  plan,
  live,
  onOpen,
}: {
  plan: SilaPlanArtifact;
  live?: boolean;
  onOpen?: () => void;
}) {
  return (
    <InlineBlock
      icon={ClipboardList}
      title="Plan"
      pill={live ? "awaiting your decision" : "proposed"}
    >
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
        <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug text-neutral-800">
          {plan.goal}
        </p>
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 font-medium text-[13px] transition-colors",
              live
                ? "border border-neutral-300 bg-neutral-200 text-neutral-900 hover:bg-neutral-300"
                : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            )}
          >
            <PanelRight className="size-3.5" />
            {live ? "Review the plan" : "View the plan"}
          </button>
        )}
      </div>
    </InlineBlock>
  );
}

/**
 * "Show me before you build it" — a real dry-run sample of the agent's output, rendered
 * inline BEFORE anything is created or posted. When it carries the LIVE confirm id it is
 * the approval point itself: Accept & build / Adjust live on the card (no separate popup).
 * A neutral white/gray card — reads as a document preview, not a status.
 */
function PreviewBlock({
  variant,
  output,
  destination,
  spec,
  specSlots,
  live,
  onConfirm,
  onAdjust,
}: {
  /** "confirm" = the reflected spec as an inline confirm block (no dry-run). */
  variant?: string;
  output: string;
  destination?: string | null;
  spec?: string;
  specSlots?: SilaSpecSlot[];
  live?: boolean;
  onConfirm?: (accept: boolean) => void;
  onAdjust?: (values: Record<string, string>) => void;
}) {
  const isConfirm = variant === "confirm";
  const rows = specSlots ?? [];
  // The user never sees a raw cron: schedules display (and edit) as the humanized
  // phrase — the backend parses phrases back into a cron on save.
  const shown = (r: SilaSpecSlot) => (r.kind === "schedule" ? formatSchedule(r.value) : r.value);
  // Adjust = edit the spec IN PLACE on this card (name, schedule, recipient…);
  // Save sends only the changed values, which re-confirm with a fresh card.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const changed = rows.filter(
    (r) => !r.readonly && draft[r.id] !== undefined && draft[r.id].trim() !== shown(r)
  );

  function save() {
    if (!onAdjust || changed.length === 0) return;
    onAdjust(Object.fromEntries(changed.map((r) => [r.id, (draft[r.id] ?? "").trim()])));
    setEditing(false);
    setDraft({});
  }

  return (
    <InlineBlock
      icon={isConfirm ? Check : Eye}
      title={
        isConfirm
          ? "What I'll build"
          : destination
            ? `Preview — what it would post to ${destination}`
            : "Preview — sample output"
      }
      pill={isConfirm ? "nothing is built yet" : "nothing was sent"}
    >
      <>
        {/* Model output renders as markdown (headings, bullets, tables) — raw
            asterisks read as noise. The confirm variant shows only the spec grid. */}
        {!isConfirm && (
          <div className="px-3.5 py-3 text-[13px] leading-relaxed text-neutral-800">
            <SimpleMarkdown text={output} />
          </div>
        )}
        {rows.length > 0 ? (
          <dl className="grid gap-x-10 gap-y-4 border-neutral-100 border-t px-4 py-4 sm:grid-cols-2">
            {rows.map((r) => (
              <div key={r.id} className="min-w-0">
                <dt className="mb-1 font-medium text-[11px] text-neutral-400 uppercase tracking-wide">
                  {r.label}
                </dt>
                {editing && !r.readonly ? (
                  <input
                    value={draft[r.id] ?? shown(r)}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    className="w-full rounded-md border border-neutral-200 px-2 py-1 text-[13.5px] text-neutral-900 outline-none focus:border-neutral-500"
                  />
                ) : (
                  <dd className="truncate text-[13.5px] text-neutral-900">{shown(r)}</dd>
                )}
              </div>
            ))}
          </dl>
        ) : (
          isConfirm &&
          spec && (
            <p className="px-3.5 py-2.5 text-[12px] leading-relaxed text-neutral-500">{spec}</p>
          )
        )}
        {live && onConfirm ? (
          <div className="flex items-center gap-2 border-neutral-100 border-t bg-neutral-50/70 px-4 py-3">
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={changed.length === 0}
                  onClick={save}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 font-medium text-[13px] text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
                >
                  <Check className="size-3.5" /> Save changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft({});
                  }}
                  className="inline-flex h-8 items-center rounded-lg border border-neutral-200 px-3 font-medium text-[13px] text-neutral-600 transition-colors hover:bg-white"
                >
                  Cancel
                </button>
                <span className="ml-auto text-[11px] text-neutral-400">
                  Saving previews the updated agent
                </span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onConfirm(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-4 font-medium text-[13px] text-white transition-colors hover:bg-neutral-800"
                >
                  <Check className="size-3.5" /> Accept
                </button>
                <button
                  type="button"
                  onClick={() =>
                    rows.length > 0 && onAdjust ? setEditing(true) : onConfirm(false)
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 font-medium text-[13px] text-neutral-600 transition-colors hover:bg-white"
                >
                  <Pencil className="size-3.5" /> Adjust
                </button>
              </>
            )}
          </div>
        ) : (
          <p className="border-neutral-100 border-t bg-neutral-50/50 px-3.5 py-2 text-[11px] text-neutral-500">
            Not quite right? Add more documents or adjust the settings and I'll preview again —
            nothing is built until you confirm.
          </p>
        )}
      </>
    </InlineBlock>
  );
}

/**
 * Outbound-email guardrail as an INLINE Outlook draft card (no popup): the real
 * Outlook mark, the recipient/subject, the rendered body, and — while it carries
 * the LIVE confirm id — Send / Cancel. Nothing leaves the mailbox until Send.
 * Read-only on a reopened turn (the buttons are gone once the confirm resolves).
 */
function EmailDraftBlock({
  draft,
  live,
  onConfirm,
}: {
  draft: SilaEmailDraft;
  live?: boolean;
  onConfirm?: (confirmed: boolean) => void;
}) {
  return (
    <div className="my-1 w-full max-w-xl overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      {/* Header — Outlook identity + Draft badge */}
      <div className="flex items-center justify-between border-neutral-100 border-b px-4 py-2.5">
        <span className="flex items-center gap-2">
          <img
            src="/icons/icons8-microsoft-outlook-2025-50.png"
            alt="Outlook"
            className="size-5"
            width={20}
            height={20}
          />
          <span className="font-medium text-[13px] text-neutral-800">Send with Outlook</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
          <Check className="size-3" /> Draft
        </span>
      </div>

      {/* Recipient + subject */}
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-baseline gap-3 text-[13px]">
          <span className="w-14 shrink-0 text-[11px] text-neutral-400 uppercase tracking-wide">
            To
          </span>
          <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 font-medium text-[12.5px] text-neutral-700">
            {draft.to}
          </span>
        </div>
        <div className="flex items-baseline gap-3 text-[13px]">
          <span className="w-14 shrink-0 text-[11px] text-neutral-400 uppercase tracking-wide">
            Subject
          </span>
          <span className="min-w-0 font-semibold text-neutral-900">{draft.subject}</span>
        </div>
      </div>

      {/* Body — rendered markdown, framed like an editor surface */}
      <div className="border-neutral-100 border-t px-4 py-3">
        <div className="sila-prose max-h-72 overflow-y-auto text-[13px] leading-relaxed text-neutral-800 [overflow-wrap:anywhere]">
          <SimpleMarkdown text={draft.body} />
        </div>
        <p className="mt-2 text-[11px] text-neutral-400">
          Sila formats this into a branded email and adds the signature.
        </p>
      </div>

      {/* Actions — only while this is the pending confirm (read-only afterwards) */}
      {live && onConfirm && (
        <div className="flex items-center justify-end gap-2 border-neutral-100 border-t bg-neutral-50/70 px-4 py-2.5">
          <button
            type="button"
            onClick={() => onConfirm(false)}
            className="inline-flex h-8 items-center rounded-lg border border-neutral-200 px-3.5 font-medium text-[13px] text-neutral-600 transition-colors hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-neutral-900 px-4 font-medium text-[13px] text-white transition-colors hover:bg-neutral-800"
          >
            <Mail className="size-3.5" /> Send email
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Inline workflow block — Claude-artifact style. Collapsed by default (a compact
 * header card); expand renders the REAL n8n editor (read-only — writes/executions are
 * 403'd by middleware.ts and the /n8n/* non-GET default-deny) in-flow, no modal/overlay
 * over the app. A static dimmed/frosted layer sits over the canvas so it reads as a
 * display-only preview; it's pointer-events-none, so pan/zoom still work underneath.
 * SilaBuildCanvas is only a defensive fallback if a build somehow has no workflow id.
 */
function CanvasBlock({
  workflowId,
  definition,
}: {
  workflowId?: string;
  definition?: SilaCanvasDef;
}) {
  const [open, setOpen] = useState(false);
  return (
    <InlineBlock
      icon={Workflow}
      title="Your agent's workflow"
      pill="Draft — pending security review"
      pillClass="bg-amber-50 text-amber-700"
      onHeaderClick={() => setOpen((o) => !o)}
      headerExpanded={open}
    >
      {open ? (
        <div className="p-2">
          {/* The canvas + a still, shaded overlay (visual only — no motion). */}
          <div className="relative h-[460px] overflow-hidden rounded-xl border border-neutral-200">
            {workflowId ? (
              <SilaN8nView workflowId={workflowId} />
            ) : (
              <SilaBuildCanvas definition={definition} />
            )}
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-white/30" />
          </div>
        </div>
      ) : null}
    </InlineBlock>
  );
}
