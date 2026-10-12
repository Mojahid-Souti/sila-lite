"use client";

import { SilaAskSheet } from "@/components/app/sila/sila-ask-sheet";
import { SilaGlyph } from "@/components/app/sila/sila-brand";
import { SilaConnectPanel } from "@/components/app/sila/sila-connect-panel";
import { SilaDocWait } from "@/components/app/sila/sila-doc-wait";
import { SilaFileDoc } from "@/components/app/sila/sila-file-doc";
import { SilaIncognitoPanel } from "@/components/app/sila/sila-incognito-panel";
import { SilaPlanDoc } from "@/components/app/sila/sila-plan-doc";
import { SilaRoster } from "@/components/app/sila/sila-roster";
import {
  SilaSlidesLauncher,
  type SlideTemplatePick,
} from "@/components/app/sila/sila-slides-launcher";
import { SilaTrace } from "@/components/app/sila/sila-trace";
import type { SilaPlanAction } from "@/components/app/sila/sila-trace";
import { SilaVoiceMode } from "@/components/app/sila/sila-voice-mode";
import { SkillChips } from "@/components/app/sila/skill-chips";
import { SkillPicker } from "@/components/app/sila/skill-picker";
import { TemplatePickerModal } from "@/components/app/sila/template-picker";
import { useChatSkills, useTemplateAnnouncement } from "@/components/app/sila/use-chat-skills";
import { useWorkspaces } from "@/components/app/workspace-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type BuiltinTemplateOut, type SilaMemoryOut, api } from "@/lib/api";
import { OKR_TEMPLATE_ID, ROUTES } from "@/lib/constants";
import { csvPreview as csvRecordsPreview } from "@/lib/csv-records";
import { getFirstNameFromToken } from "@/lib/jwt-user";
import { relativeTime } from "@/lib/relative-time";
import { formatSchedule } from "@/lib/schedule";
import {
  type SilaArtifact,
  type SilaBuildSeed,
  type SilaPlanArtifact,
  type SilaSegment,
  type SilaSkillRef,
  type SilaWorkerLane,
  isTurnInFlight,
  useSilaSocket,
} from "@/lib/sila-socket";
import { SimpleMarkdown } from "@/lib/simple-markdown";
import { useToast } from "@/lib/toast";
import { useDictation } from "@/lib/use-dictation";
import { useMe } from "@/lib/use-me";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  CircleUser,
  ClipboardList,
  Copy,
  FileSearch,
  FileText,
  Gauge,
  Info,
  Languages,
  type LucideIcon,
  Mail,
  MessagesSquare,
  Mic,
  Pencil,
  Plug,
  Plus,
  Presentation,
  RefreshCw,
  ScrollText,
  Sparkles,
  Square,
  Store,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
  Upload,
  Workflow,
  Wrench,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** A file shown with a user message — name for the badge, preview for the card
 *  body, content for the click-to-open side preview. */
type MsgAttachment = { name: string; preview?: string; content?: string };

/** What the side pane is showing: an uploaded file, or a generated one. */
type FilePane = { name: string; content?: string; url?: string };

type Msg = {
  id: string;
  role: "user" | "sila";
  content: string;
  timeline?: SilaSegment[];
  attachments?: MsgAttachment[];
  /** ISO time the message was stored. Absent on a turn that just streamed —
   *  the action bar falls back to the client clock for those. */
  createdAt?: string;
};

// Claude-style greetings — one picked at random per visit.
const NAMED_GREETINGS: ((name: string) => string)[] = [
  (n) => `${n} returns!`,
  (n) => `Welcome back, ${n}`,
  (n) => `Good to see you, ${n}`,
  (n) => `Ready when you are, ${n}`,
  (n) => `Where to today, ${n}?`,
  (n) => `Let's get to it, ${n}`,
];
const ANON_GREETINGS = [
  "How can I help?",
  "Ready when you are",
  "Where shall we start?",
  "Let's get to it",
];

function pickGreeting(name: string | null): string {
  const pool = name ? NAMED_GREETINGS : null;
  if (pool && name) return pool[Math.floor(Math.random() * pool.length)](name);
  return ANON_GREETINGS[Math.floor(Math.random() * ANON_GREETINGS.length)];
}

// Quick-start chips — most prefill the composer; "Generate slides" opens the
// template gallery (Kimi-style) instead.
const STARTERS: { icon: LucideIcon; label: string; prompt: string; action?: "slides" }[] = [
  { icon: Sparkles, label: "Build an agent", prompt: "I want to build an agent that " },
  { icon: FileText, label: "Summarize a doc", prompt: "Summarize this document: " },
  { icon: Presentation, label: "Generate slides", prompt: "", action: "slides" },
  { icon: Store, label: "Find an agent", prompt: "Find me an agent that can " },
];

function Starters({
  onPick,
  onSlides,
}: {
  onPick: (prompt: string) => void;
  onSlides: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      {STARTERS.map(({ icon: Icon, label, prompt, action }) => (
        <button
          key={label}
          type="button"
          onClick={() => (action === "slides" ? onSlides() : onPick(prompt))}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-150 ease-out hover:-translate-y-px hover:border-neutral-300 hover:text-neutral-900 hover:shadow-sm active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
        >
          <Icon className="size-3.5 shrink-0 text-neutral-400" />
          {label}
        </button>
      ))}
    </div>
  );
}

// The real Slack mark (4-color brand asset). A brand logo is the one place a
// non-token color is correct — it reads as "connected to the real tool," not
// decoration. Everything else on the strip stays monochrome-plus-one-accent.
function SlackMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <path d="M5.04 15.16a2.4 2.4 0 1 1-2.4-2.4h2.4v2.4Z" fill="#E01E5A" />
      <path d="M6.25 15.16a2.4 2.4 0 0 1 4.8 0v6a2.4 2.4 0 1 1-4.8 0v-6Z" fill="#E01E5A" />
      <path d="M8.65 5.04a2.4 2.4 0 1 1 2.4-2.4v2.4h-2.4Z" fill="#36C5F0" />
      <path d="M8.65 6.25a2.4 2.4 0 0 1 0 4.8h-6a2.4 2.4 0 1 1 0-4.8h6Z" fill="#36C5F0" />
      <path d="M18.96 8.65a2.4 2.4 0 1 1 2.4 2.4h-2.4v-2.4Z" fill="#2EB67D" />
      <path d="M17.75 8.65a2.4 2.4 0 0 1-4.8 0v-6a2.4 2.4 0 1 1 4.8 0v6Z" fill="#2EB67D" />
      <path d="M15.35 18.96a2.4 2.4 0 1 1-2.4 2.4v-2.4h2.4Z" fill="#ECB22E" />
      <path d="M15.35 17.75a2.4 2.4 0 0 1 0-4.8h6a2.4 2.4 0 1 1 0 4.8h-6Z" fill="#ECB22E" />
    </svg>
  );
}

// Starter templates — a template is a complete, well-formed build request that gets a
// non-expert past the blank box. HONEST to what completes end-to-end today: only Slack,
// SMTP email, and KB summarization/Q&A are fully wired, so these are the only starts we
// offer (no Gmail/Teams — their build nodes don't exist yet). Picking one fills the
// composer so the user reads/tweaks it, then sends → the normal preview-first interview.
type TemplateDef = {
  Icon: React.ComponentType<{ className?: string }>;
  branded?: boolean; // full-color brand mark (Slack) — skip the accent tint
  title: string;
  blurb: string;
  prompt: string;
};

const TEMPLATES: TemplateDef[] = [
  {
    Icon: SlackMark,
    branded: true,
    title: "Daily doc summary → Slack",
    blurb: "Summarizes your documents and posts to a channel",
    prompt:
      'Build an agent called "Daily Doc Digest" that summarizes my uploaded documents into 3–5 concise bullet points every weekday at 9am and posts them to Slack.',
  },
  {
    Icon: Mail,
    title: "Daily doc summary → Email",
    blurb: "Summarizes your documents and emails them to you",
    prompt:
      "Build an agent that summarizes my uploaded documents into 3–5 concise bullet points every weekday at 9am and emails them to me.",
  },
  {
    Icon: FileSearch,
    title: "Q&A from your docs",
    blurb: "Answers questions grounded only in your documents",
    prompt:
      "Build an agent that answers questions using only my uploaded documents, and clearly says it doesn't know when the answer isn't in them.",
  },
];

// The reusable interactive-card language for the app (Linear/Attio discipline):
// neutral surface + subtle lift on hover, one accent (primary) reserved for the
// SELECTED/active state (border + soft wash), a tactile press-scale, and a
// prefers-reduced-motion fallback (state change without transform/transition).
// Apply this same pattern to other card surfaces (workspace/connector cards) later.
function TemplatePicker({
  selected,
  onPick,
}: {
  selected: string | null;
  onPick: (prompt: string, title: string) => void;
}) {
  return (
    <div className="mt-8 w-full">
      <p className="mb-2.5 text-center font-medium text-[11px] text-neutral-400 uppercase tracking-wider">
        Or start from a template
      </p>
      <div className="grid items-stretch gap-2.5 sm:grid-cols-3">
        {TEMPLATES.map(({ Icon, branded, title, blurb, prompt }) => {
          const isSel = selected === title;
          return (
            <button
              key={title}
              type="button"
              aria-pressed={isSel}
              onClick={() => onPick(prompt, title)}
              className={cn(
                "group flex h-full flex-col items-start gap-1 rounded-xl border p-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 ease-out active:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none",
                isSel
                  ? "-translate-y-0.5 border-primary bg-primary/[0.04] shadow-md"
                  : "border-neutral-200 bg-white hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              )}
            >
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg transition-colors",
                  branded
                    ? "bg-neutral-100"
                    : isSel
                      ? "bg-primary/10 text-primary"
                      : "bg-neutral-100 text-neutral-600 group-hover:bg-primary/10 group-hover:text-primary"
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="mt-1 font-medium text-[13px] text-neutral-900">{title}</span>
              <span className="flex-1 text-neutral-500 text-xs leading-snug">{blurb}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A document attachment card (Claude/v0-style): a file-type badge + name + kind.
function fileMeta(name: string): { label: string; color: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { label: "PDF", color: "bg-red-50 text-red-600" };
  if (ext === "doc" || ext === "docx") return { label: "Word", color: "bg-blue-50 text-blue-600" };
  if (ext === "xls" || ext === "xlsx" || ext === "csv")
    return { label: "Sheet", color: "bg-emerald-50 text-emerald-600" };
  if (ext === "txt" || ext === "md")
    return { label: "Text", color: "bg-neutral-100 text-neutral-500" };
  return { label: ext ? ext.toUpperCase() : "File", color: "bg-neutral-100 text-neutral-500" };
}

function DocCard({
  name,
  preview,
  onOpen,
}: {
  name: string;
  preview?: string;
  /** Click → the side preview pane (the chat slides left, like the plan). */
  onOpen?: () => void;
}) {
  const { label, color } = fileMeta(name);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      title={onOpen ? "Open the preview" : undefined}
      className={cn(
        "relative flex h-28 w-40 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white p-3 text-left shadow-sm transition-all sm:w-44",
        onOpen && "cursor-pointer hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md"
      )}
    >
      {/* Preview area — the file's first lines when we could read them, else the name. */}
      {preview ? (
        <p
          dir="auto"
          className="line-clamp-4 flex-1 break-words font-mono text-[9.5px] leading-snug text-neutral-500"
        >
          {preview}
        </p>
      ) : (
        <p className="line-clamp-3 flex-1 break-words text-[13px] font-medium leading-snug text-neutral-700">
          {name}
        </p>
      )}
      {/* Footer: type badge + (when the body shows a preview) the name. */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex w-fit shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            color
          )}
        >
          {label}
        </span>
        {preview && (
          <span dir="auto" className="min-w-0 truncate text-[10px] text-neutral-500">
            {name}
          </span>
        )}
      </div>
    </button>
  );
}

// "/" SILA action commands — picking one pins a chip in the composer and
// prepends its prefix to the sent message. (The chip is removable.)
type ActionCommand = { id: string; label: string; icon: LucideIcon; prefix: string };

const ACTION_COMMANDS: ActionCommand[] = [
  { id: "summarize", label: "Summarize", icon: FileText, prefix: "Summarize the following:\n\n" },
  { id: "build", label: "Build an agent", icon: Sparkles, prefix: "Build an agent that " },
  { id: "workflow", label: "Draft a workflow", icon: Workflow, prefix: "Create a workflow that " },
  { id: "find", label: "Find an agent", icon: Store, prefix: "Find me an agent that can " },
  { id: "translate", label: "Translate", icon: Languages, prefix: "Translate the following:\n\n" },
];

/** A composer attachment. For text-like files the CONTENT is read in the browser:
 *  a short preview renders on the card, and the full text rides the sent message so
 *  SILA can actually answer questions about the file (a name alone tells it nothing). */
type FileChip = {
  id: string;
  name: string;
  preview?: string;
  content?: string;
  /** Set when the file was uploaded as a server-side dataset (Analysis Engine):
   *  the bytes live on disk and DuckDB reads the FULL file — no truncation. */
  datasetId?: string;
  rows?: number | null;
};

const TEXT_EXTENSIONS = new Set(["txt", "md", "vtt", "csv", "json", "log", "yaml", "yml", "html"]);
// Files whose FULL text must reach the server-side tools (the backend shows
// the model only a head sample): tabular data + meeting transcripts (a 6k cap
// on .txt cut a 17k transcript and the PDD roster lost speakers — live bug).
const FULL_TEXT_EXTENSIONS = new Set(["csv", "tsv", "txt", "md", "vtt"]);
const ATTACH_CONTENT_MAX = 6000; // chars of file text sent with the message
// Tabular files carry far more: the backend stashes the FULL rows for the data
// tools and shows the model only a head sample, so size no longer costs context.
const ATTACH_CSV_MAX = 150_000;
const ATTACH_PREVIEW_MAX = 220; // chars shown on the card

/** A structured card preview for tabular files — "38 rows · 17 columns" plus the
 *  leading column names reads far better than raw comma soup. Counted as CSV
 *  records, so a quoted line break is not a row. */
function csvPreview(text: string): string {
  return csvRecordsPreview(text, ATTACH_PREVIEW_MAX);
}

// Mirrors the server's attachment markers (runner.stash_attachments): pull the
// file bodies OUT of a stored user turn and back into attachment cards.
const STORED_ATTACH_RE = /\n?\[Attached file: ([^\]]+)\]\n([\s\S]*?)\n\[End of \1\]/g;
const STORED_DATASET_RE = /\n?\[Attached dataset: (.+?) dataset_id=[0-9a-fA-F-]{36} rows=(\d+)\]/g;

function splitStoredAttachments(raw: string): { text: string; attachments?: MsgAttachment[] } {
  const attachments: MsgAttachment[] = [];
  const text = raw
    .replace(STORED_ATTACH_RE, (_match, name: string, body: string) => {
      attachments.push({
        name,
        content: body,
        preview: name.toLowerCase().endsWith(".csv")
          ? csvPreview(body)
          : body.slice(0, ATTACH_PREVIEW_MAX),
      });
      return "";
    })
    .replace(STORED_DATASET_RE, (_match, name: string, rows: string) => {
      attachments.push({
        name,
        preview: `Full dataset · ${Number(rows).toLocaleString()} rows`,
      });
      return "";
    })
    .trim();
  return attachments.length > 0 ? { text, attachments } : { text: raw };
}

async function readFileChip(file: File): Promise<FileChip> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const chip: FileChip = { id: crypto.randomUUID(), name: file.name };
  if (TEXT_EXTENSIONS.has(ext)) {
    try {
      const text = (await file.text()).trim();
      if (text) {
        chip.content = text.slice(
          0,
          FULL_TEXT_EXTENSIONS.has(ext) ? ATTACH_CSV_MAX : ATTACH_CONTENT_MAX
        );
        chip.preview = ext === "csv" ? csvPreview(text) : text.slice(0, ATTACH_PREVIEW_MAX);
      }
    } catch {
      /* unreadable → name-only card */
    }
  }
  return chip;
}

/** The composer's attachment card — preview + type badge + remove (Claude-style). */
/** Attachments shown before the stack tile takes over. Five fits the composer's
 *  width at the card size without wrapping or scrolling on a normal screen. */
const VISIBLE_FILES = 5;

/** The overflow tile — two tilted cards peeking out behind a front one, so it
 *  reads as a PILE at a glance rather than another file. Click to expand. */
function MoreFilesCard({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${count} more attached ${count === 1 ? "file" : "files"}`}
      className="group relative h-32 w-40 shrink-0"
    >
      <span
        aria-hidden
        className="-rotate-[5deg] absolute inset-0 rounded-2xl border border-neutral-200 bg-white shadow-sm transition-transform duration-200 group-hover:-rotate-[7deg]"
      />
      <span
        aria-hidden
        className="absolute inset-0 rotate-[4deg] rounded-2xl border border-neutral-200 bg-white shadow-sm transition-transform duration-200 group-hover:rotate-[6deg]"
      />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-neutral-200 bg-white shadow-sm transition-colors group-hover:border-neutral-300">
        <span className="font-semibold text-[19px] text-neutral-800 leading-none">+{count}</span>
        <span className="text-[11px] text-neutral-400">more {count === 1 ? "file" : "files"}</span>
      </span>
    </button>
  );
}

function AttachCard({ chip, onRemove }: { chip: FileChip; onRemove: () => void }) {
  const { label, color } = fileMeta(chip.name);
  return (
    <div className="relative flex h-32 w-40 shrink-0 flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-sm">
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${chip.name}`}
        className="absolute top-1 right-1 grid size-5 place-items-center rounded-md bg-white/80 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        <X className="size-3.5" />
      </button>
      {/* Name and type only. The card used to render `chip.preview` — raw parsed
          content ("158 rows · 5 columns, Date per year, …") spilling out of a
          72px tile before anyone asked for it, which also pushed the filename
          down to an unreadable 9px. The preview still rides the sent message;
          it just isn't wallpaper. */}
      <p
        dir="auto"
        title={chip.name}
        className="line-clamp-3 pr-5 font-medium text-[12.5px] text-neutral-800 leading-snug [overflow-wrap:anywhere]"
      >
        {chip.name}
      </p>
      <span
        className={cn(
          "mt-auto inline-flex w-fit shrink-0 items-center rounded-md px-1.5 py-0.5 font-bold text-[9px] uppercase tracking-wide",
          color
        )}
      >
        {label}
      </span>
    </div>
  );
}

// A removable label in the composer (an action command or an attached file).
function Chip({
  icon: Icon,
  label,
  onRemove,
}: {
  icon: LucideIcon;
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 py-1 pr-1 pl-2 text-[13px] text-neutral-700">
      <Icon className="size-3.5 text-neutral-500" />
      <span className="max-w-[180px] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="grid size-5 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

const EFFORTS = ["Low", "Medium", "High", "Extra", "Max"] as const;
type Effort = (typeof EFFORTS)[number];

/** "qwen2.5:7b-instruct" → "qwen2.5:7b" for display. */
function shortModel(m: string): string {
  return m.replace(/-instruct$/i, "");
}

// Fallback only. The backend's `recommended` list is the real answer — it knows
// the provider and the allowlist. This copy drifted once (no "qwen3", so a
// tool-calling qwen3 model was labelled "Chat only") and duplicated lists always
// will, so it is used only when the API returns no `recommended`.
const TOOL_CAPABLE_HINTS = [
  "qwen3",
  "qwen2.5",
  "qwen2:",
  "llama3.1",
  "llama3.3",
  "mistral",
  "command-r",
  "firefunction",
  "hermes",
  "glm4",
];
function isToolCapable(name: string): boolean {
  const n = name.toLowerCase();
  return TOOL_CAPABLE_HINTS.some((h) => n.includes(h));
}

/** A short Claude-style capability blurb per model family. */
function modelSubtitle(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("qwen")) return "Strong all-rounder, great tool use";
  if (n.includes("gemma")) return "Efficient, fast everyday tasks";
  if (n.includes("glm")) return "Capable bilingual model";
  if (n.includes("deepseek")) return "Reasoning-focused";
  if (n.includes("aya")) return "Multilingual, strong Arabic";
  if (n.includes("phi")) return "Small and fast";
  if (n.includes("llama")) return "Meta's open model";
  if (n.startsWith("sila")) return "Hosted · strong tool use, 1M context";
  return "Local model";
}

const DEFAULT_EFFORT: Effort = "High";

/** Small inline toggle (no shadcn Switch in the project). */
function MiniSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full outline-none transition-colors focus-visible:ring-0",
        checked ? "bg-blue-600" : "bg-neutral-300"
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/**
 * Composer model picker (local Ollama models). Selecting a model reconnects the
 * SILA socket so the session routes through it. "Thinking" effort is cosmetic —
 * the local qwen has no reasoning-effort knob (kept for parity with the design).
 */
function ModelMenu({
  models,
  model,
  onSelectModel,
  effort,
  onSelectEffort,
  recommended,
}: {
  models: string[];
  model: string;
  onSelectModel: (m: string) => void;
  effort: Effort;
  onSelectEffort: (e: Effort) => void;
  /** Tool-capable models per the API. Authoritative when present. */
  recommended?: string[];
}) {
  // Thinking toggle is cosmetic (local Ollama has no reasoning-effort knob).
  const [thinking, setThinking] = useState(true);
  // Keep the active model in the inline list (not hidden under "More models").
  const ordered =
    model && models.includes(model) ? [model, ...models.filter((m) => m !== model)] : models;
  const top = ordered.slice(0, 5);
  const more = ordered.slice(5);
  const renderModel = (m: string) => {
    const capable = recommended?.length ? recommended.includes(m) : isToolCapable(m);
    return (
      <DropdownMenuItem
        key={m}
        onSelect={() => onSelectModel(m)}
        className="items-start gap-2 rounded-lg px-2.5 py-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-[13px] text-neutral-900">
              {shortModel(m)}
            </span>
            {capable ? (
              <span className="shrink-0 rounded-full bg-green-50 px-1.5 py-px font-medium text-[10px] text-green-700">
                Builds
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-px font-medium text-[10px] text-amber-700">
                Chat only
              </span>
            )}
          </div>
          <div className="truncate text-[12px] text-neutral-400">
            {capable ? modelSubtitle(m) : "May not open tools or build reliably"}
          </div>
        </div>
        {m === model && <Check className="mt-0.5 size-4 shrink-0 text-blue-600" />}
      </DropdownMenuItem>
    );
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-neutral-600 outline-none transition-colors hover:bg-neutral-100 focus-visible:ring-0"
        >
          <span className="max-w-[140px] truncate font-medium">{shortModel(model) || "Model"}</span>
          <span className="text-neutral-400">{effort}</span>
          <ChevronDown className="size-3.5 text-neutral-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-64 rounded-2xl p-1.5"
      >
        <DropdownMenuLabel className="px-2.5 font-normal text-[11px] text-neutral-400">
          Model
        </DropdownMenuLabel>
        {top.map(renderModel)}
        {more.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 rounded-lg px-2.5 py-2 text-[13px] outline-none focus:bg-neutral-100 focus:text-neutral-900 focus-visible:ring-0 data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-900">
              <span className="flex-1">More models</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 w-60 overflow-y-auto rounded-xl p-1">
              {more.map(renderModel)}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2 rounded-lg px-2.5 py-2 text-[13px] outline-none focus:bg-neutral-100 focus:text-neutral-900 focus-visible:ring-0 data-[state=open]:bg-neutral-100 data-[state=open]:text-neutral-900">
            <Gauge className="size-4 text-neutral-500" />
            <span className="flex-1">Effort</span>
            <span className="text-neutral-400">{effort}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64 rounded-xl p-1">
            <p className="px-2.5 pt-1.5 pb-1 text-[12px] leading-snug text-neutral-400">
              Higher effort means more thorough responses, but takes longer and uses your limits
              faster.
            </p>
            {EFFORTS.map((e) => (
              <DropdownMenuItem
                key={e}
                onSelect={() => onSelectEffort(e)}
                className="gap-2 rounded-lg px-2.5 py-1.5 text-[13px]"
              >
                <span>{e}</span>
                {e === DEFAULT_EFFORT && (
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                    Default
                  </span>
                )}
                {e === "Max" && <Info className="size-3.5 text-neutral-400" />}
                <span className="flex-1" />
                {e === effort && <Check className="size-4 text-blue-600" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(ev) => ev.preventDefault()}
              className="items-center gap-2 rounded-lg px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-neutral-900">Thinking</div>
                <div className="text-[12px] text-neutral-400">Can think for more complex tasks</div>
              </div>
              <MiniSwitch checked={thinking} onChange={() => setThinking((v) => !v)} />
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// SILA modes (Claude-Code-style) — each is a different system prompt + tool scope on the
// backend. Switching reconnects the socket so the new mode's prompt takes effect. Shift+Tab
// cycles them; the active mode tints the composer border + send button.
export type SilaMode = "auto" | "build" | "plan";
type ModeAccent = "orange" | "blue" | null;
const MODES: {
  id: SilaMode;
  label: string;
  icon: LucideIcon;
  blurb: string;
  accent: ModeAccent;
}[] = [
  {
    id: "auto",
    label: "Auto",
    icon: Sparkles,
    blurb: "SILA picks the best approach for each message",
    accent: null,
  },
  {
    id: "build",
    label: "Build",
    icon: Wrench,
    blurb: "Build & configure a new agent, step by step",
    accent: "orange",
  },
  {
    id: "plan",
    label: "Plan",
    icon: ClipboardList,
    blurb: "Explore, explain & find ready-made agents — no building",
    accent: "blue",
  },
];

// Per-accent classes for the composer form border + send button (only Build/Plan tint;
// Auto stays neutral).
const ACCENT: Record<"orange" | "blue", { form: string; send: string }> = {
  orange: {
    form: "border-orange-300 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100",
    send: "bg-orange-500 text-white hover:bg-orange-600",
  },
  blue: {
    form: "border-blue-300 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100",
    send: "bg-blue-500 text-white hover:bg-blue-600",
  },
};

function accentFor(mode: SilaMode): ModeAccent {
  return MODES.find((m) => m.id === mode)?.accent ?? null;
}

function cycleMode(mode: SilaMode): SilaMode {
  const i = MODES.findIndex((m) => m.id === mode);
  return MODES[(i + 1) % MODES.length].id;
}

/** Composer mode picker — switching reconnects the SILA socket with the new prompt. */
function ModeMenu({
  mode,
  onSelectMode,
  pill,
}: {
  mode: SilaMode;
  onSelectMode: (m: SilaMode) => void;
  /** Tray styling: a white chip that reads as a control sitting ON the tinted
   *  shelf. The bare toolbar styling would disappear against the gradient. */
  pill?: boolean;
}) {
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 outline-none transition-colors focus-visible:ring-0",
            pill
              ? "h-8 shrink-0 rounded-lg px-2 font-medium text-[13px] text-neutral-700 hover:bg-white/70 data-[state=open]:bg-white/70"
              : "rounded-lg px-2 py-1 text-[13px] text-neutral-600 hover:bg-neutral-100"
          )}
        >
          <current.icon className={cn("text-neutral-400", pill ? "size-4" : "size-3.5")} />
          <span className="font-medium">{current.label}</span>
          <ChevronDown className="size-3.5 text-neutral-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-64 rounded-2xl p-1.5"
      >
        <div className="flex items-center justify-between px-2.5 py-1">
          <span className="font-normal text-[11px] text-neutral-400 uppercase tracking-wider">
            Mode
          </span>
          <span className="text-[10px] text-neutral-300">⇧ Tab to switch</span>
        </div>
        {MODES.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onSelect={() => onSelectMode(m.id)}
            className="items-start gap-2 rounded-lg px-2.5 py-2"
          >
            <m.icon className="mt-0.5 size-4 shrink-0 text-neutral-500" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[13px] text-neutral-900">{m.label}</div>
              <div className="text-[12px] text-neutral-400">{m.blurb}</div>
            </div>
            {m.id === mode && <Check className="mt-0.5 size-4 shrink-0 text-blue-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Small Account & Usage modal — a session summary plus what SILA remembers. */
function AccountUsageDialog({
  open,
  onOpenChange,
  email,
  model,
  memory,
  onDeleteMemory,
  onClearMemory,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  email: string;
  model: string;
  memory: SilaMemoryOut | null;
  onDeleteMemory: (id: string) => void;
  onClearMemory: () => void;
}) {
  // Clearing is destructive — an explicit confirm step with a warning first.
  const [confirmClear, setConfirmClear] = useState(false);
  const count = memory?.items.length ?? 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setConfirmClear(false);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Account &amp; Usage</DialogTitle>
          <DialogDescription>Your SILA session at a glance.</DialogDescription>
        </DialogHeader>
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-neutral-500">Account</dt>
            <dd className="truncate font-medium text-neutral-900">{email || "—"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-neutral-500">Model</dt>
            <dd className="truncate font-medium text-neutral-900">{shortModel(model) || "—"}</dd>
          </div>
        </dl>

        {/* Memory — what SILA remembers about YOU (per user, across chats). */}
        <div className="mt-1 rounded-xl border border-neutral-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium text-neutral-900 text-sm">Memory</p>
            <span
              className={`text-[11.5px] ${memory?.full ? "font-semibold text-amber-600" : "text-neutral-400"}`}
            >
              {count}/{memory?.limit ?? 20}
              {memory?.full ? " · full" : ""}
            </span>
          </div>
          {count === 0 ? (
            <p className="text-[12.5px] text-neutral-400">
              Nothing yet — SILA saves lasting preferences here as you chat.
            </p>
          ) : (
            <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {memory?.items.map((m) => (
                <li
                  key={m.id}
                  className="group flex items-start gap-2 rounded-lg bg-neutral-50 px-2.5 py-1.5"
                >
                  <span className="min-w-0 flex-1 text-[12.5px] text-neutral-700 leading-snug">
                    {m.content}
                  </span>
                  <button
                    type="button"
                    aria-label="Delete memory"
                    onClick={() => onDeleteMemory(m.id)}
                    className="grid size-6 shrink-0 place-items-center rounded-md text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {count > 0 &&
            (confirmClear ? (
              <div className="mt-2.5 rounded-lg border border-red-200 bg-red-50 p-2.5">
                <p className="flex items-start gap-1.5 text-[12px] text-red-700 leading-snug">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  This permanently erases everything SILA remembers about you. It can't be undone.
                </p>
                <div className="mt-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="h-7 rounded-md border border-neutral-200 bg-white px-2.5 font-medium text-[12px] text-neutral-700 hover:bg-neutral-50"
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClearMemory();
                      setConfirmClear(false);
                    }}
                    className="h-7 rounded-md bg-red-600 px-2.5 font-medium text-[12px] text-white hover:bg-red-500"
                  >
                    Erase memory
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="mt-2.5 text-[12px] text-neutral-400 underline-offset-2 hover:text-red-600 hover:underline"
              >
                Clear all memory…
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * SILA chat — a Claude-style conversation thread on the SILA WebSocket. The WS
 * client streams only the latest reply, so the thread keeps its own history:
 * the previous reply is committed when the next message is sent. The composer
 * offers push-to-talk dictation (🎤) and a call-like voice mode (the orb-centric
 * SilaVoiceMode).
 */
const EMPTY_MODELS: string[] = [];
const NO_SKILLS: SilaSkillRef[] = [];
const NO_SKILL_IDS: string[] = [];

export function SilaChat() {
  const token = useToken();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? undefined;
  // A Bazaar "Use template" deep link (?template=tpl-…) pins a built-in
  // template for the session: a rich chip on the composer + the persona
  // server-side (the socket hello carries only the ID).
  const templateParam = searchParams.get("template") ?? "";
  const [agentTpl, setAgentTpl] = useState<BuiltinTemplateOut | null>(null);
  // Bazaar skills attached to the chat (?skill=<id> from "Use skill", or "/").
  const chatSkills = useChatSkills({
    token,
    skillParam: searchParams.get("skill") ?? "",
    okrPinned: agentTpl?.id === OKR_TEMPLATE_ID,
  });
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  useTemplateAnnouncement(agentTpl?.name);
  // "/" → Use a template: the centered picker (same registry the Bazaar lists).
  const [tplPickerOpen, setTplPickerOpen] = useState(false);
  const { currentId } = useWorkspaces();
  const [model, setModel] = useState("");
  const [mode, setMode] = useState<SilaMode>("auto");
  const [effort, setEffort] = useState<Effort>("High");
  const [accountOpen, setAccountOpen] = useState(false);
  const email = useMe().me?.email ?? "";
  // Per-user memory (Mojahid's design): shown under Account & Usage; when FULL
  // the composer blocks sending until the user frees space.
  // One shared query rather than a hand-rolled fetch: two effects call
  // refreshMemory (mount + "turn went idle"), and since the socket reports idle
  // on mount both fired, so every page load fetched /sila/memory twice.
  const { data: memoryData, refetch: refetchMemory } = useQuery({
    queryKey: ["sila-memory"],
    queryFn: () => api.sila.memory(token),
    enabled: !!token,
    staleTime: 30 * 1000,
  });
  const memory = memoryData ?? null;
  const refreshMemory = useCallback(() => {
    void refetchMemory();
  }, [refetchMemory]);
  const memoryFull = memory?.full ?? false;
  // Plan→Build handoff: an accepted plan's seed rides the next hello (the mode switch
  // reconnects); `handoff` is the auto-sent message that resumes the paused turn.
  const [buildSeed, setBuildSeed] = useState<SilaBuildSeed | null>(null);
  const [handoff, setHandoff] = useState<string | null>(null);
  const sila = useSilaSocket({
    token,
    workspaceId: currentId,
    onNavigate: (path) => router.push(path),
    model,
    mode,
    sessionId,
    buildSeed,
    template: agentTpl?.id,
    skills: chatSkills.ids,
    onSkills: chatSkills.onServerSkills,
  });
  // SILA may have saved a fact mid-turn (the remember tool) — recheck when a
  // turn FINISHES. Keyed on the transition into idle, not on the idle state
  // itself: the socket is already idle at mount, so the un-guarded version
  // double-fetched alongside the query's own initial load.
  const wasBusyRef = useRef(false);
  useEffect(() => {
    const busy = isTurnInFlight(sila.state);
    if (wasBusyRef.current && !busy) refreshMemory();
    wasBusyRef.current = busy;
  }, [sila.state, refreshMemory]);

  // Resolve the deep-linked template's card data (name/hint) for the chip.
  useEffect(() => {
    if (!token || !templateParam) return;
    let cancelled = false;
    api.bazaar
      .templates(token)
      .then((list) => {
        if (!cancelled) setAgentTpl(list.find((t) => t.id === templateParam) ?? null);
      })
      .catch(() => {
        /* unknown template — the chat simply opens without a chip */
      });
    return () => {
      cancelled = true;
    };
  }, [token, templateParam]);

  // Local models for the picker. A query, not an effect: the model list is
  // process-wide and near-static, so callers share one cached response instead
  // of each mount issuing its own request.
  const { data: modelData } = useQuery({
    queryKey: ["sila-models"],
    queryFn: () => api.sila.listModels(token),
    enabled: !!token,
    staleTime: 10 * 60 * 1000,
  });
  const models = modelData?.models ?? EMPTY_MODELS;
  const recommendedModels = modelData?.recommended ?? EMPTY_MODELS;
  useEffect(() => {
    if (modelData?.default) setModel((m) => m || modelData.default);
  }, [modelData?.default]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  // Resume from Recents: load the chosen session's transcript (or clear for a
  // fresh session). Tool turns are internal, so only user/sila rows are shown.
  useEffect(() => {
    if (!token) return;
    setBuildSeed(null); // a seed never outlives the session it was accepted in
    if (!sessionId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    api.sila
      .getSession(sessionId, token)
      .then((r) => {
        if (cancelled) return;
        setMessages(
          r.messages
            .filter((m) => m.role === "user" || m.role === "sila")
            .map((m) => {
              // Stored user turns carry attached files inline as
              // [Attached file: NAME]…[End of NAME] markers — rebuild them into
              // attachment cards (with FULL content, so the CSV grid preview
              // works after a reconnect) instead of dumping raw file bodies.
              const { text, attachments } =
                m.role === "user"
                  ? splitStoredAttachments(m.content)
                  : { text: m.content, attachments: undefined };
              return {
                id: crypto.randomUUID(),
                role: m.role as "user" | "sila",
                content: text,
                attachments,
                // Replay the persisted process-trace (vetting/tool steps) if present.
                timeline: m.trace ?? undefined,
                createdAt: m.created_at ?? undefined,
              };
            })
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId, token]);
  // Emptying the composer deselects the loaded template card.
  useEffect(() => {
    if (!input.trim()) setPickedTpl(null);
  }, [input]);
  // Latest streamed reply, kept in a ref so submit() can commit the prior turn.
  const liveReplyRef = useRef("");
  liveReplyRef.current = sila.reply;
  // Snapshot of the live turn's trace, committed with the reply so it persists.
  const liveTimelineRef = useRef<SilaSegment[]>([]);
  liveTimelineRef.current = sila.timeline;

  const [voiceMode, setVoiceMode] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  // Docs-wait (no pop-up): the build pauses; the user drops files into the chat.
  const [docsBusy, setDocsBusy] = useState(false);
  const [docsError, setDocsError] = useState("");
  const [docsNudged, setDocsNudged] = useState(false);
  const { toast } = useToast();
  // File side preview (same pane as the plan document) — an UPLOADED file
  // carries its text inline; a GENERATED artifact carries a URL the pane
  // fetches its preview from.
  const [filePane, setFilePane] = useState<FilePane | null>(null);
  // The Kimi-style slides launcher (template gallery + slide count). The pick
  // rides the composer as a CHIP; submit composes the full request around it.
  const [slidesOpen, setSlidesOpen] = useState(false);
  const [slideTpl, setSlideTpl] = useState<SlideTemplatePick | null>(null);
  // Which home-screen template card is currently "loaded" into the composer —
  // kept selected until the user clears the composer (or sends, which leaves the
  // empty view entirely).
  const [pickedTpl, setPickedTpl] = useState<string | null>(null);
  // The build canvas now renders inline in the trace (a collapsible block that scrolls
  // with the chat + persists with the message) — no modal.
  const [command, setCommand] = useState<ActionCommand | null>(null);
  const [files, setFiles] = useState<FileChip[]>([]);
  const dictation = useDictation((text) => setInput((v) => (v ? `${v} ${text}` : text)));
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const name = getFirstNameFromToken(token);
  // Stable per visit; re-rolls once when the name resolves from the token.
  const greeting = useMemo(() => pickGreeting(name), [name]);
  const thinking = sila.state === "thinking";
  // The live message must stay mounted while the trace holds anything — a
  // deterministic resume streams NO tokens, so on the confirm interrupt the state
  // leaves "thinking" with an empty reply and the preview block (which carries the
  // Accept & build buttons) would unmount while the docked sheet stays suppressed:
  // the build looked stuck with no way to confirm.
  const hasLive = sila.reply.length > 0 || thinking || sila.timeline.length > 0;
  const empty = messages.length === 0 && !hasLive;
  // Newest settled SILA row — its avatar keeps the live googly eye. O(n) scan
  // per render is fine at chat-history sizes.
  const lastSilaIdx = messages.reduce((acc, m, i) => (m.role === "sila" ? i : acc), -1);
  // Model only cold-loads once a session — show "Loading {model}" on turn 1 only.
  const isFirstTurn = messages.every((m) => m.role !== "sila");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-scroll as the thread grows + streams
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sila.reply, thinking]);

  // Push a user message (committing any live reply first) and send it as a turn.
  // `display` is what the bubble shows (the user's words); `composed` is what SILA
  // receives (may carry attached-file content the bubble must never dump raw).
  // Capture the prior reply/timeline BEFORE the updater + send, otherwise the
  // next turn's "thinking" reset can blank the ref before the updater reads it.
  // Does a turn leave anything behind once its live view is cleared?
  //
  // A turn that ends by ASKING — the agent spec to confirm, a schedule to pick —
  // streams no closing prose, so `priorReply` is empty. Committing only on text
  // threw that turn away: answering "Yes, build it" made the confirmation card
  // above it vanish, and with it the plan and any artifact the turn produced.
  function worthKeeping(timeline: SilaSegment[]): boolean {
    return timeline.some(
      (seg) =>
        (seg.type === "text" && seg.text.trim().length > 0) ||
        seg.type === "preview" ||
        seg.type === "plan" ||
        seg.type === "dashboard" ||
        seg.type === "canvas" ||
        seg.type === "email" ||
        (seg.type === "tool" && ((seg.artifacts?.length ?? 0) > 0 || (seg.tasks?.length ?? 0) > 0))
    );
  }

  function dispatch(composed: string, attachments?: MsgAttachment[], display?: string) {
    const text = composed.trim();
    if (!text) return;
    setInterrupted(false);
    const priorReply = liveReplyRef.current;
    const priorTimeline = liveTimelineRef.current;
    liveReplyRef.current = "";
    setMessages((prev) => {
      const next = [...prev];
      if (priorReply || worthKeeping(priorTimeline)) {
        next.push({
          id: crypto.randomUUID(),
          role: "sila",
          content: priorReply,
          timeline: priorTimeline,
          createdAt: new Date().toISOString(),
        });
      }
      next.push({
        id: crypto.randomUUID(),
        role: "user",
        content: (display ?? composed).trim(),
        attachments,
      });
      return next;
    });
    sila.send(text);
    sila.clearModal();
  }

  // The plain text of a past message — the reply for a SILA turn (its content or the
  // text rows of its timeline), or the user's words.
  function messageText(m: Msg): string {
    if (m.content) return m.content;
    return (m.timeline ?? [])
      .filter((s): s is Extract<SilaSegment, { type: "text" }> => s.type === "text")
      .map((s) => s.text)
      .join("")
      .trim();
  }

  // Copy / regenerate / thumbs on a SILA answer; copy on a user message.
  function onMessageAction(action: MessageAction, m: Msg) {
    if (action === "copy") {
      void navigator.clipboard.writeText(messageText(m));
      toast("Copied to clipboard", "success");
    } else if (action === "up") {
      toast("Feedback noted — thanks!", "success");
    } else if (action === "down") {
      toast("Sorry about that — we'll improve this in a future update.", "info");
    } else if (action === "regenerate") {
      // Re-run the user turn that produced this answer: find the last user message
      // at or before it, drop everything after it, and re-send.
      const idx = messages.findIndex((x) => x.id === m.id);
      const search = idx === -1 ? messages : messages.slice(0, idx + 1);
      const lastUser = [...search].reverse().find((x) => x.role === "user");
      if (!lastUser) return;
      const userIdx = messages.findIndex((x) => x.id === lastUser.id);
      setMessages((prev) => prev.slice(0, userIdx + 1));
      sila.send(messageText(lastUser));
    }
  }

  // Edit a user message IN PLACE: trim the thread from that message and re-send the
  // new text as a fresh turn (ChatGPT-style branch replace).
  function onEditUser(m: Msg, text: string) {
    const idx = messages.findIndex((x) => x.id === m.id);
    if (idx === -1) return;
    setMessages((prev) => prev.slice(0, idx));
    dispatch(text); // adds the new user bubble + sends
  }

  function submit() {
    const text = input.trim();
    if (!text && files.length === 0) return;
    if (memoryFull) return; // hard block — free memory first (composer shows why)
    // A pending FREEFORM ask ("what should I change?") captures the typed message
    // as its answer — recorded deterministically server-side, no model round. The
    // question bubble is committed into the thread first so it doesn't vanish
    // when the ask clears (it lives on sila.ask, which resets on resume).
    if (sila.ask?.freeform && text) {
      const question = sila.ask.questions[0]?.question ?? "";
      if (question) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "sila", content: question },
        ]);
      }
      submitAsk({ [sila.ask.questions[0]?.id ?? "__change__"]: text });
      setInput("");
      return;
    }
    setBuildSeed(null); // a typed message supersedes any pending plan seed
    // Attached text files ride the SENT message in full (so SILA can answer from
    // them); the bubble shows the user's words + the cards, never the raw dump.
    const fileNote = files.length
      ? `\n\n${files
          .map((f) =>
            f.datasetId
              ? `[Attached dataset: ${f.name} dataset_id=${f.datasetId} rows=${f.rows ?? 0}]`
              : f.content
                ? `[Attached file: ${f.name}]\n${f.content}\n[End of ${f.name}]`
                : `[Attached: ${f.name} — content not readable in the browser]`
          )
          .join("\n\n")}`
      : "";
    // A picked slide style composes the full request around the user's topic. A
    // built-in palette names the `palette`; a corporate upload names the `template`.
    let lead = command?.prefix ?? "";
    if (slideTpl) {
      const stylePart = slideTpl.palette
        ? ` using the ${slideTpl.palette} palette`
        : ` on the "${slideTpl.name}" template`;
      const countPart = slideTpl.count === "Auto" ? "" : ` with ${slideTpl.count} slides`;
      // The type shapes CONTENT (density, what a slide leads with); the palette
      // only shapes looks. Naming it here is what makes the choice do anything.
      const typePart = slideTpl.deckType
        ? ` as a ${slideTpl.deckTypeLabel ?? slideTpl.deckType} deck`
        : "";
      lead = `Make me a slide deck${typePart}${stylePart}${countPart} about: `;
    }
    dispatch(
      `${lead}${text}${fileNote}`,
      files.length
        ? files.map((f) => ({ name: f.name, preview: f.preview, content: f.content }))
        : undefined,
      `${lead}${text}`
    );
    setInput("");
    setCommand(null);
    setSlideTpl(null);
    setFiles([]);
  }

  // Plan→Build handoff, step 2: once the mode switch has taken effect (the socket
  // reconnects with the seed in its hello), auto-send the message that resumes the
  // paused plan turn as a build. A beat's delay lets the old socket close first.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dispatch is stable enough here (component-scope fn)
  useEffect(() => {
    if (!handoff || mode !== "build") return;
    const t = setTimeout(() => {
      dispatch(handoff);
      setHandoff(null);
    }, 120);
    return () => clearTimeout(t);
  }, [handoff, mode]);

  // The plan document (side panel). It auto-opens once per proposal when the live
  // plan arrives; the compact in-chat block re-opens it (read-only when stale).
  const [planDoc, setPlanDoc] = useState<{ plan: SilaPlanArtifact; requestId?: string } | null>(
    null
  );
  const autoOpenedPlanRef = useRef<string | null>(null);
  useEffect(() => {
    const live = sila.timeline.find(
      (s) => s.type === "plan" && s.requestId && s.requestId === sila.ask?.requestId
    );
    if (live && live.type === "plan" && live.requestId !== autoOpenedPlanRef.current) {
      autoOpenedPlanRef.current = live.requestId ?? null;
      setFilePane(null);
      setPlanDoc({ plan: live.plan, requestId: live.requestId });
    }
  }, [sila.timeline, sila.ask]);

  // The two side panes (plan document / file preview) are mutually exclusive.
  // A generated artifact opens the same pane. Named for what it does rather
  // than for the tile that triggers it — the agent kind never reaches here.
  const openArtifactPane = (art: SilaArtifact) => {
    // A card the security gateway blocked is not openable from anywhere — the
    // tile already refuses the click, and this is the second lock on the door.
    if (!art.url || art.security?.status === "blocked") return;
    setPlanDoc(null);
    setFilePane({ name: art.name, url: art.url });
  };

  const openPlanPane = (plan: SilaPlanArtifact, requestId?: string) => {
    setFilePane(null);
    setPlanDoc({ plan, requestId });
  };
  const openFilePane = (att: MsgAttachment) => {
    setPlanDoc(null);
    setFilePane(att);
  };

  // What each plan decision does. Accept is the deterministic handoff:
  // seed the interview + switch to Build; the seeded gate skips what the plan
  // settled and still requires the final confirm (nothing is built here).
  function onPlanAction(_requestId: string, action: SilaPlanAction, plan: SilaPlanArtifact) {
    setPlanDoc(null);
    if (action === "accept") {
      if (plan.seed?.agent_type) setBuildSeed(plan.seed);
      sila.clearAsk();
      setMode("build");
      setHandoff("Build it as planned — go ahead.");
    } else if (action === "adjust") {
      // Conversational edit: the user types the change; their next message resumes
      // the paused turn and the plan is re-proposed with the feedback folded in.
      sila.clearAsk();
      setInput("");
      inputRef.current?.focus();
    } else if (action === "discard") {
      submitAsk({ __plan__: "Discard the plan — let's not build this." });
    } else if (action === "hire" && plan.bazaarMatch) {
      submitAsk({
        __plan__: `Hire "${plan.bazaarMatch.name}" (agent id ${plan.bazaarMatch.id}) from the Bazaar instead of building.`,
      });
    }
  }

  // Big tabular files upload as server-side DATASETS (DuckDB analyses the full
  // file — no head-truncation); small ones ride the message inline as before.
  // A failed upload falls back to the inline (truncated) path silently.
  async function toFileChip(file: File): Promise<FileChip> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    // A workbook can't be read in the browser: it always uploads, whatever its
    // size, and the server keeps the original (the OKR pack reads it). With the
    // OKR template pinned a CSV uploads too: the sheet stays server-side and the
    // chat model sees only its name, never its content.
    const serverSide = ext === "xlsx" || (ext === "csv" && agentTpl?.id === OKR_TEMPLATE_ID);
    if (serverSide && token && currentId) {
      try {
        const ds = await api.sila.uploadDataset(currentId, file, token);
        return {
          id: crypto.randomUUID(),
          name: ds.filename,
          datasetId: ds.id,
          rows: ds.rows,
          preview: `Sheet uploaded${ds.rows != null ? ` · ${ds.rows.toLocaleString()} rows` : ""}`,
        };
      } catch (err) {
        console.error("sheet upload failed", err);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          preview: "⚠ the sheet couldn't be uploaded — try attaching it again",
        };
      }
    }
    if ((ext === "csv" || ext === "tsv") && file.size > ATTACH_CSV_MAX && token && currentId) {
      try {
        const ds = await api.sila.uploadDataset(currentId, file, token);
        return {
          id: crypto.randomUUID(),
          name: ds.filename,
          datasetId: ds.id,
          rows: ds.rows,
          preview: `Full dataset uploaded${
            ds.rows != null ? ` · ${ds.rows.toLocaleString()} rows` : ""
          } · ${(ds.size_bytes / (1024 * 1024)).toFixed(1)} MB`,
        };
      } catch (err) {
        console.error("dataset upload failed — falling back to inline (truncated)", err);
        const chip = await readFileChip(file);
        chip.preview = `⚠ upload failed — only the first rows are analyzed\n${chip.preview ?? ""}`;
        return chip;
      }
    }
    return readFileChip(file);
  }

  const composer = (
    <Composer
      value={input}
      onChange={setInput}
      onSubmit={submit}
      onStop={() => {
        sila.stop();
        setInterrupted(true);
      }}
      busy={thinking}
      textareaRef={inputRef}
      onDictate={dictation.toggle}
      dictating={dictation.listening}
      dictationSupported={dictation.supported}
      onVoice={() => setVoiceMode(true)}
      command={command}
      files={files}
      onPickCommand={setCommand}
      onRemoveCommand={() => setCommand(null)}
      slideTpl={slideTpl}
      onRemoveSlideTpl={() => setSlideTpl(null)}
      agentTpl={agentTpl}
      onRemoveAgentTpl={() => setAgentTpl(null)}
      skills={chatSkills.skills ?? NO_SKILLS}
      onRemoveSkill={chatSkills.remove}
      onAddSkill={() => setSkillPickerOpen(true)}
      onAddFiles={(picked) => {
        void Promise.all(picked.map(toFileChip)).then((chips) => setFiles((f) => [...f, ...chips]));
      }}
      onRemoveFile={(id) => setFiles((f) => f.filter((x) => x.id !== id))}
      models={models}
      recommended={recommendedModels}
      model={model}
      onSelectModel={setModel}
      mode={mode}
      onSelectMode={setMode}
      effort={effort}
      onSelectEffort={setEffort}
      onAccountUsage={() => setAccountOpen(true)}
      onUseTemplate={() => setTplPickerOpen(true)}
      memoryFull={memoryFull}
      onManageMemory={() => setAccountOpen(true)}
    />
  );

  const templatePicker = (
    <>
      <TemplatePickerModal
        open={tplPickerOpen}
        onOpenChange={setTplPickerOpen}
        token={token}
        activeId={agentTpl?.id}
        attachedSkills={chatSkills.skills ?? NO_SKILLS}
        onPick={(template, skills) => {
          setAgentTpl(template);
          chatSkills.setAll(skills, { okr: template.id === OKR_TEMPLATE_ID });
        }}
      />
      <SkillPicker
        open={skillPickerOpen}
        onOpenChange={setSkillPickerOpen}
        attachedIds={chatSkills.ids ?? NO_SKILL_IDS}
        onPick={(skill) => {
          chatSkills.attach(skill);
          setSkillPickerOpen(false);
        }}
      />
    </>
  );

  const accountDialog = (
    <AccountUsageDialog
      open={accountOpen}
      onOpenChange={(v) => {
        setAccountOpen(v);
        if (v) refreshMemory();
      }}
      email={email}
      model={model}
      memory={memory}
      onDeleteMemory={(id) => {
        if (!token) return;
        api.sila
          .deleteMemory(id, token)
          .then(refreshMemory)
          .catch(() => {});
      }}
      onClearMemory={() => {
        if (!token) return;
        api.sila
          .clearMemory(token)
          .then(refreshMemory)
          .catch(() => {});
      }}
    />
  );

  // The build paused for documents (open_modal). No pop-up: a docked wait bar
  // appears and the whole chat accepts drops; upload → the flow resumes itself.
  const awaitingDocs = sila.modal?.kind === "upload";

  async function uploadDocs(picked: File[]) {
    if (picked.length === 0 || docsBusy) return;
    setDocsBusy(true);
    setDocsError("");
    try {
      const chips = await Promise.all(picked.map(readFileChip));
      let kbId: string | undefined;
      if (token && currentId) {
        // Name the KB after its files so it's recognisable later (the docs picker
        // once showed a dozen identical "Agent knowledge" rows).
        const stem = picked[0].name.replace(/\.[^.]+$/, "").slice(0, 40);
        const kbName = picked.length === 1 ? stem : `${stem} +${picked.length - 1} more`;
        const kb = await api.kb.createKB(currentId, { name: kbName, scope: "workspace" }, token);
        kbId = kb.id;
        await Promise.all(picked.map((f) => api.kb.uploadDocument(currentId, kb.id, f, token)));
      }
      const names = picked.map((f) => f.name).join(", ");
      // kb_id rides the SENT text (plumbing for the build) — the bubble shows only
      // the document cards, never the id.
      dispatch(
        `I've uploaded: ${names}.${kbId ? ` (kb_id: ${kbId})` : ""} Please continue.`,
        chips.map((c) => ({ name: c.name, preview: c.preview, content: c.content })),
        ""
      );
    } catch {
      setDocsError("Couldn't upload — try again, or continue without documents.");
    } finally {
      setDocsBusy(false);
    }
  }

  const skipDocs = () => dispatch("I didn't upload anything — continue without documents.");

  // Patience protocol: after ~5 quiet minutes, ONE gentle local nudge; then stay
  // silent — the pause is durable, so SILA simply wakes when the files arrive.
  useEffect(() => {
    if (!awaitingDocs) {
      setDocsNudged(false);
      return;
    }
    if (docsNudged) return;
    const timer = setTimeout(() => {
      setDocsNudged(true);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "sila",
          content:
            "Still here — drop the documents in whenever you're ready and I'll pick up right where we left off.",
          createdAt: new Date().toISOString(),
        },
      ]);
    }, 5 * 60_000);
    return () => clearTimeout(timer);
  }, [awaitingDocs, docsNudged]);

  // The generic elicitation panel — selections go back over the WS to resume the
  // turn, and are echoed into the thread as the user's reply.
  function submitAsk(answers: Record<string, string | string[]>) {
    const requestId = sila.ask?.requestId ?? "";
    const prettify = (v: string) =>
      v.trim().split(/\s+/).length === 5 && /^[\d*/,\- ]+$/.test(v.trim())
        ? formatSchedule(v.trim())
        : v;
    const readable = Object.values(answers)
      .map((v) => (Array.isArray(v) ? v.join(", ") : v))
      .filter(Boolean)
      .map(prettify)
      .join(" · ");
    // Commit any prior narration, then show the user's choices as a message.
    const priorReply = liveReplyRef.current;
    const priorTimeline = liveTimelineRef.current;
    liveReplyRef.current = "";
    setMessages((prev) => {
      const next = [...prev];
      if (priorReply) {
        next.push({
          id: crypto.randomUUID(),
          role: "sila",
          content: priorReply,
          timeline: priorTimeline,
          createdAt: new Date().toISOString(),
        });
      }
      if (readable) next.push({ id: crypto.randomUUID(), role: "user", content: readable });
      return next;
    });
    sila.sendAskResponse(requestId, answers);
  }
  // The build confirm / plan decision is rendered ON its inline block (Accept/Adjust),
  // not in a popup — suppress the docked sheet when the pending ask matches a shown
  // preview's or plan card's request id.
  const askOnBlock = Boolean(
    sila.ask &&
      sila.timeline.some(
        (s) => (s.type === "preview" || s.type === "plan") && s.requestId === sila.ask?.requestId
      )
  );
  const onConfirmBuild = (_requestId: string, accept: boolean) =>
    submitAsk({ __confirm__: accept ? "Yes, build it" : "Let me change something" });
  // The preview card's inline spec edit — the changed slot values resume the turn
  // and the gate re-confirms with a fresh card.
  const onAdjustBuild = (_requestId: string, values: Record<string, string>) => submitAsk(values);
  // Freeform asks render as plain chat + the composer captures the answer — no sheet.
  const askSheet =
    sila.ask && !askOnBlock && !sila.ask.freeform ? (
      <SilaAskSheet ask={sila.ask} onSubmit={submitAsk} onClose={() => sila.clearAsk()} />
    ) : null;

  const cred = sila.credentialRequest;
  const incognitoPanel = cred ? (
    <SilaIncognitoPanel
      label={cred.label}
      fields={cred.fields}
      onSubmit={(values) => sila.sendCredentials(cred.requestId, cred.provider, values)}
      onSkip={() => sila.skipCredentials(cred.provider)}
    />
  ) : null;

  const connectReq = sila.connectRequest;
  const connectPanel =
    connectReq && currentId ? (
      <SilaConnectPanel
        request={connectReq}
        workspaceId={currentId}
        onDone={(provider, ok) => sila.sendConnectResult(provider, ok)}
      />
    ) : null;

  // Outbound-email guardrail — the draft renders INLINE in the trace (Outlook card),
  // not a popup. Send/Cancel commits the paused turn (so the card stays in history)
  // then resumes; the send/ack streams as the next turn.
  function handleEmailConfirm(_requestId: string, confirmed: boolean) {
    const priorReply = liveReplyRef.current;
    const priorTimeline = liveTimelineRef.current;
    liveReplyRef.current = "";
    if (priorReply || (priorTimeline && priorTimeline.length > 0)) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "sila",
          content: priorReply,
          timeline: priorTimeline,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    sila.respondEmailConfirm(confirmed);
  }

  if (voiceMode) {
    return (
      <>
        <SilaVoiceMode sila={sila} onExit={() => setVoiceMode(false)} />
      </>
    );
  }

  if (empty) {
    return (
      <div className="min-h-full bg-neutral-100">
        <div className="mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-start px-4 pt-[12vh]">
          {/* Logo inline with the greeting, on one line (Claude-style), with a
              standing subtitle underneath. The greeting is picked at random, so
              the subtitle is FIXED — two rotating lines would read as noise and
              say nothing. This one names what the box actually accepts. */}
          <div className="mb-2 flex items-center justify-center gap-3">
            <SilaGlyph live className="size-9 shrink-0 text-neutral-900 sm:size-10" />
            <h1 className="text-center font-semibold text-4xl text-neutral-900 tracking-tight">
              {greeting}
            </h1>
          </div>
          <p className="mb-8 max-w-xl text-center text-[15px] text-neutral-500 leading-relaxed">
            Ask a question, drop in a document, or describe the agent you want — SILA plans the
            work, runs the tools, and shows you every step.
          </p>
          <div className="w-full">{composer}</div>
          <Starters
            onPick={(p) => {
              setInput(p);
              inputRef.current?.focus();
            }}
            onSlides={() => setSlidesOpen(true)}
          />
          <SilaSlidesLauncher
            open={slidesOpen}
            onClose={() => setSlidesOpen(false)}
            workspaceId={currentId ?? undefined}
            onPick={(pick) => {
              setSlideTpl(pick);
              inputRef.current?.focus();
            }}
          />
          <TemplatePicker
            selected={pickedTpl}
            onPick={(p, title) => {
              setInput(p);
              setPickedTpl(title);
              inputRef.current?.focus();
            }}
          />
          {accountDialog}
          {templatePicker}
        </div>
      </div>
    );
  }

  return (
    // Split pane: the thread (left) + the side document (right). Opening a pane
    // animates its width so the chat is PUSHED left smoothly; closing returns it.
    // While a build waits for documents, the WHOLE surface is a drop target.
    <div
      className="flex h-full"
      onDragOver={(e) => {
        if (awaitingDocs) e.preventDefault();
      }}
      onDrop={(e) => {
        if (awaitingDocs && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          void uploadDocs(Array.from(e.dataTransfer.files));
        }
      }}
    >
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* Full-width scroller so the scrollbar sits at the true right edge; the
          thread is centered inside via an inner max-width wrapper. */}
        <div
          className={cn(
            "sila-scroll flex-1 overflow-y-auto py-6 transition-opacity [scrollbar-gutter:stable]",
            // Dim ONLY when a docked panel is actually shown — when the decision lives
            // ON an inline block (plan / preview), the thread must stay interactive.
            (askSheet || incognitoPanel || connectPanel) && "pointer-events-none opacity-40"
          )}
        >
          <div className="mx-auto max-w-4xl space-y-6 px-4">
            {messages.map((m, i) => (
              <Message
                key={m.id}
                msg={m}
                // The newest SILA row keeps a live eye once streaming settles.
                latest={!hasLive && m.role === "sila" && i === lastSilaIdx}
                onOpenPlan={openPlanPane}
                onOpenArtifact={openArtifactPane}
                onOpenFile={openFilePane}
                onAction={onMessageAction}
                onEditUser={onEditUser}
              />
            ))}
            {hasLive && (
              <Message
                msg={{ id: "live", role: "sila", content: sila.reply }}
                thinking={thinking}
                timeline={sila.timeline}
                roster={sila.roster}
                // The socket going idle is what says "this turn is over" — the
                // live row never becomes a settled message until the NEXT turn.
                settled={!isTurnInFlight(sila.state)}
                live
                model={isFirstTurn ? shortModel(model) : undefined}
                activeAskId={sila.ask?.requestId}
                onConfirm={onConfirmBuild}
                onAdjust={onAdjustBuild}
                onOpenPlan={openPlanPane}
                onOpenArtifact={openArtifactPane}
                onOpenFile={openFilePane}
                activeEmailId={sila.emailConfirm?.requestId}
                onEmailConfirm={handleEmailConfirm}
              />
            )}
            {sila.ask?.freeform && (
              <Message
                msg={{
                  id: "freeform-ask",
                  role: "sila",
                  content: sila.ask.questions[0]?.question ?? "",
                }}
                onOpenPlan={openPlanPane}
                onOpenArtifact={openArtifactPane}
                onOpenFile={openFilePane}
              />
            )}
            {interrupted && <p className="text-[13px] text-neutral-400 italic">Interrupted</p>}
            {/* A rejected/failed connection must be VISIBLE — a sent message dying
                silently reads as "the AI doesn't respond" (live bug). */}
            {sila.closeReason && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                <Info className="size-4 shrink-0" />
                {sila.closeReason}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
        {/* Composer (same centered column); the elicitation panel docks above it. */}
        <div className="relative">
          {(askSheet || incognitoPanel || connectPanel || awaitingDocs) && (
            <div className="absolute inset-x-0 bottom-full z-20 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="mx-auto max-w-4xl px-4">
                {askSheet ??
                  incognitoPanel ??
                  connectPanel ??
                  (awaitingDocs ? (
                    <SilaDocWait
                      prompt={sila.modal?.prompt}
                      busy={docsBusy}
                      error={docsError}
                      onFiles={(picked) => void uploadDocs(picked)}
                      onSkip={skipDocs}
                    />
                  ) : null)}
              </div>
            </div>
          )}
          <div className="mx-auto max-w-4xl px-4 pb-4">{composer}</div>
        </div>
      </div>
      {/* The plan document pane — width animates (0 → half) so the push feels smooth;
          the inner min-width keeps the document from reflowing while it slides. */}
      <div
        className={cn(
          "h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-out",
          planDoc || filePane ? "w-[min(48rem,52%)]" : "w-0"
        )}
      >
        {planDoc ? (
          <div className="h-full min-w-[28rem]">
            <SilaPlanDoc
              plan={planDoc.plan}
              live={Boolean(planDoc.requestId && planDoc.requestId === sila.ask?.requestId)}
              onClose={() => setPlanDoc(null)}
              onAction={(action) => onPlanAction(planDoc.requestId ?? "", action, planDoc.plan)}
            />
          </div>
        ) : filePane ? (
          <div className="h-full min-w-[28rem]">
            <SilaFileDoc
              name={filePane.name}
              content={filePane.content}
              fileUrl={filePane.url}
              onClose={() => setFilePane(null)}
            />
          </div>
        ) : null}
      </div>
      {accountDialog}
    </div>
  );
}

// SILA's inline avatar — the S mark on a white rounded-square tile. `animate`
// wakes the googly eye (streaming + newest message only — not every row).
function SilaMark({ className, animate = false }: { className?: string; animate?: boolean }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg border border-neutral-200 bg-white shadow-sm",
        className
      )}
    >
      <SilaGlyph live={animate} className="size-[62%]" />
    </span>
  );
}

type MessageAction = "copy" | "regenerate" | "up" | "down";

/** A small icon button used in the message action rows (hover-revealed). */
function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
    >
      {icon}
    </button>
  );
}

/** A user message bubble with inline edit (Enter / Save resends, trimming the
 *  thread from here) + copy — the edit happens ON the bubble, not the composer. */
function UserBubble({
  content,
  onCopy,
  onSubmitEdit,
}: {
  content: string;
  onCopy: () => void;
  onSubmitEdit?: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function begin() {
    setDraft(content);
    setEditing(true);
    // Focus + grow to fit on the next frame.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }
  function save() {
    const text = draft.trim();
    setEditing(false);
    if (text && text !== content) onSubmitEdit?.(text);
  }

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="w-full max-w-[80%] rounded-2xl border border-neutral-300 bg-white px-3 py-2">
          <textarea
            ref={ref}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                setEditing(false);
              }
            }}
            className="w-full resize-none bg-transparent text-sm text-neutral-900 outline-none"
            rows={1}
          />
          <div className="mt-1.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800"
            >
              Send
            </button>
          </div>
        </div>
        <span className="text-[11px] text-neutral-400">Enter to send · Esc to cancel</span>
      </div>
    );
  }

  return (
    <div className="group flex flex-col items-end gap-1">
      <div className="max-w-[80%] overflow-hidden whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-[15px] text-neutral-900 leading-relaxed">
        {content}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onSubmitEdit && (
          <ActionButton label="Edit" icon={<Pencil className="size-3.5" />} onClick={begin} />
        )}
        <ActionButton label="Copy" icon={<Copy className="size-3.5" />} onClick={onCopy} />
      </div>
    </div>
  );
}

/** The action row under a SILA answer: copy · regenerate · thumbs up/down. */
function MessageActions({
  onCopy,
  onRegenerate,
  onFeedback,
  createdAt,
  pinned,
}: {
  onCopy: () => void;
  onRegenerate: () => void;
  onFeedback: (v: "up" | "down") => void;
  createdAt?: string;
  /** The newest reply keeps its bar visible; older ones reveal on hover, so a
   *  long thread does not read as a wall of icon rows. */
  pinned?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-1 flex items-center gap-0.5 transition-opacity",
        pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}
    >
      <ActionButton label="Copy" icon={<Copy className="size-3.5" />} onClick={onCopy} />
      <ActionButton
        label="Regenerate"
        icon={<RefreshCw className="size-3.5" />}
        onClick={onRegenerate}
      />
      <ActionButton
        label="Good response"
        icon={<ThumbsUp className="size-3.5" />}
        onClick={() => onFeedback("up")}
      />
      <ActionButton
        label="Bad response"
        icon={<ThumbsDown className="size-3.5" />}
        onClick={() => onFeedback("down")}
      />
      {createdAt && (
        <span className="ml-1.5 text-[11.5px] text-neutral-400">{relativeTime(createdAt)}</span>
      )}
    </div>
  );
}

function Message({
  msg,
  thinking,
  timeline,
  roster,
  live,
  latest,
  model,
  activeAskId,
  onConfirm,
  onAdjust,
  onOpenPlan,
  onOpenArtifact,
  onOpenFile,
  activeEmailId,
  onEmailConfirm,
  onAction,
  onEditUser,
  settled,
}: {
  msg: Msg;
  thinking?: boolean;
  timeline?: SilaSegment[];
  roster?: SilaWorkerLane[];
  live?: boolean;
  /** The newest settled SILA message — its avatar's eye stays alive. */
  latest?: boolean;
  model?: string;
  activeAskId?: string;
  onConfirm?: (requestId: string, accept: boolean) => void;
  onAdjust?: (requestId: string, values: Record<string, string>) => void;
  onOpenPlan?: (plan: SilaPlanArtifact, requestId?: string) => void;
  onOpenArtifact?: (art: SilaArtifact) => void;
  onOpenFile?: (att: MsgAttachment) => void;
  activeEmailId?: string;
  onEmailConfirm?: (requestId: string, confirmed: boolean) => void;
  // AI message actions (copy / regenerate / feedback) and user-message edit
  // (submits the new text, trimming the thread from that message).
  onAction?: (action: MessageAction, msg: Msg) => void;
  onEditUser?: (msg: Msg, text: string) => void;
  /** The socket is idle — this live turn has finished, text included. */
  settled?: boolean;
}) {
  if (msg.role === "user") {
    // Attachment cards + the user's words, stacked right-aligned — the raw file
    // content never renders (it rides the sent message only).
    return (
      <div className="space-y-2">
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {msg.attachments.map((file) => (
              <DocCard
                key={file.name}
                name={file.name}
                preview={file.preview}
                onOpen={onOpenFile ? () => onOpenFile(file) : undefined}
              />
            ))}
          </div>
        )}
        {msg.content && (
          <UserBubble
            content={msg.content}
            onCopy={() => onAction?.("copy", msg)}
            onSubmitEdit={onEditUser ? (text) => onEditUser(msg, text) : undefined}
          />
        )}
      </div>
    );
  }
  return (
    <div className="group flex gap-3">
      <SilaMark animate={live || latest} className="-mt-0.5 size-7" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-neutral-800">
        {live ? (
          <>
            <SilaTrace
              timeline={timeline ?? []}
              thinking={!!thinking}
              model={model}
              activeAskId={activeAskId}
              onConfirm={onConfirm}
              onAdjust={onAdjust}
              onOpenPlan={onOpenPlan}
              onOpenArtifact={onOpenArtifact}
              activeEmailId={activeEmailId}
              onEmailConfirm={onEmailConfirm}
              settled={settled}
            />
            {roster && roster.length > 0 && <SilaRoster roster={roster} />}
          </>
        ) : msg.timeline && msg.timeline.length > 0 ? (
          <SilaTrace
            timeline={msg.timeline}
            thinking={false}
            onOpenPlan={onOpenPlan}
            onOpenArtifact={onOpenArtifact}
            collapsible
          />
        ) : (
          msg.content && (
            <div dir="auto" className="sila-prose [overflow-wrap:anywhere]">
              <SimpleMarkdown text={msg.content} />
            </div>
          )
        )}
        {/* The newest reply stays the "live" row until the user sends another
            message, so gating on !live alone meant the answer you just read was
            the one answer you could not copy, rate or regenerate. `settled` is
            the turn actually finishing — the same signal the attachment cards
            use. */}
        {(!live || settled) && onAction && (msg.content || (msg.timeline?.length ?? 0) > 0) && (
          <MessageActions
            onCopy={() => onAction("copy", msg)}
            onRegenerate={() => onAction("regenerate", msg)}
            onFeedback={(v) => onAction(v, msg)}
            createdAt={msg.createdAt}
            pinned={latest}
          />
        )}
      </div>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  textareaRef,
  onDictate,
  dictating,
  dictationSupported,
  onVoice,
  command,
  files,
  onPickCommand,
  onRemoveCommand,
  slideTpl,
  onRemoveSlideTpl,
  agentTpl,
  onRemoveAgentTpl,
  skills,
  onRemoveSkill,
  onAddSkill,
  onAddFiles,
  onRemoveFile,
  models,
  recommended,
  model,
  onSelectModel,
  mode,
  onSelectMode,
  effort,
  onSelectEffort,
  onAccountUsage,
  onUseTemplate,
  memoryFull,
  onManageMemory,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onDictate: () => void;
  dictating: boolean;
  dictationSupported: boolean;
  onVoice: () => void;
  command: ActionCommand | null;
  slideTpl: SlideTemplatePick | null;
  onRemoveSlideTpl: () => void;
  agentTpl: BuiltinTemplateOut | null;
  onRemoveAgentTpl: () => void;
  /** Bazaar skills attached to the chat (composer cards beside the template). */
  skills: SilaSkillRef[];
  onRemoveSkill: (id: string) => void;
  onAddSkill: () => void;
  files: FileChip[];
  onPickCommand: (c: ActionCommand) => void;
  onRemoveCommand: () => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  models: string[];
  /** Tool-capable models per the API — passed straight to the picker. */
  recommended: string[];
  model: string;
  onSelectModel: (m: string) => void;
  mode: SilaMode;
  onSelectMode: (m: SilaMode) => void;
  effort: Effort;
  onSelectEffort: (e: Effort) => void;
  onAccountUsage: () => void;
  onUseTemplate: () => void;
  /** SILA's per-user memory hit its cap — sending is blocked until pruned. */
  memoryFull: boolean;
  onManageMemory: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Attachments collapse past a handful — see VISIBLE_FILES. Expanding swaps the
  // stack tile for the full set, still on ONE horizontally-scrolling row so the
  // composer's height never depends on how much you attached.
  const [filesExpanded, setFilesExpanded] = useState(false);
  useEffect(() => {
    if (files.length <= VISIBLE_FILES) setFilesExpanded(false);
  }, [files.length]);
  const canSend = (value.trim().length > 0 || files.length > 0) && !busy && !memoryFull;
  const hasChips =
    command !== null ||
    files.length > 0 ||
    slideTpl !== null ||
    agentTpl !== null ||
    skills.length > 0;
  const accent = accentFor(mode);
  // Auto-grow the textarea with its content up to the cap (then the thin
  // sila-scroll bar takes over). Layout effect + measure-from-zero so the height
  // settles BEFORE paint (no scroll-jump while typing) and an emptied composer
  // (after send) collapses back to its resting size instead of staying tall.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `value` is the resize trigger (scrollHeight changes with it)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!value) {
      el.style.height = ""; // resting size (min-h) when empty — never a stale tall box
      return;
    }
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 104), 256)}px`;
  }, [value, textareaRef]);
  return (
    // GRAY FRAME — wraps the whole composer, with the white input inset inside
    // it and the context tray below, so input + attachments + controls read as
    // one block. Radius is concentric: 1.875rem outer = 1.5rem inner + the
    // 6px (p-1.5) gap, so the corners stay parallel instead of pinching.
    // neutral-200/70 rather than neutral-100 because the landing page is
    // already neutral-100 — the frame has to sit ABOVE its own background, and
    // the same value works over the white chat view.
    <div className="rounded-[1.875rem] border border-neutral-200/80 bg-neutral-200/70 p-1.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className={cn(
          // duration-300 so a mode switch FADES the accent in (no flash); the composer's
          // text lives in React state, so it survives the switch untouched.
          "rounded-3xl border bg-white shadow-sm transition-all duration-300 focus-within:shadow-md",
          accent
            ? ACCENT[accent].form
            : "border-neutral-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) onAddFiles(picked);
            e.target.value = "";
          }}
        />
        {memoryFull && (
          // Hard block (Mojahid's design): memory at cap → no sending until the
          // user frees space; the button opens Account & Usage → Memory.
          <div className="flex items-center gap-2 border-amber-200 border-b bg-amber-50 px-3.5 py-2">
            <TriangleAlert className="size-4 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1 text-[12.5px] text-amber-800">
              SILA's memory is full — free some space before sending new messages.
            </p>
            <button
              type="button"
              onClick={onManageMemory}
              className="h-7 shrink-0 rounded-md border border-amber-300 bg-white px-2.5 font-medium text-[12px] text-amber-800 hover:bg-amber-100"
            >
              Manage memory
            </button>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            } else if (e.key === "Tab" && e.shiftKey) {
              // Shift+Tab cycles the mode (Auto → Build → Plan → …), like Claude Code.
              e.preventDefault();
              onSelectMode(cycleMode(mode));
            }
          }}
          rows={1}
          placeholder="Ask SILA, or paste a doc to get started"
          className="sila-scroll block max-h-64 min-h-[104px] w-full resize-none overflow-y-auto bg-transparent px-5 pt-4 text-[15.5px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center justify-between px-2.5 pb-2.5">
            <div className="flex items-center gap-0.5">
              <ComposerToolsMenu onUpload={() => fileInputRef.current?.click()} />
              <ComposerSlashMenu
                onPick={onPickCommand}
                onAccountUsage={onAccountUsage}
                onUseTemplate={onUseTemplate}
                onAddSkill={onAddSkill}
              />
            </div>
            <div className="flex items-center gap-0.5">
              <ModelMenu
                models={models}
                model={model}
                onSelectModel={onSelectModel}
                effort={effort}
                onSelectEffort={onSelectEffort}
                recommended={recommended}
              />
              {dictationSupported && (
                <ComposerTooltip label="Dictate">
                  <button
                    type="button"
                    onClick={onDictate}
                    aria-label="Dictate"
                    className={cn(
                      "grid size-8 place-items-center rounded-lg outline-none transition-colors hover:bg-neutral-100 focus-visible:ring-0",
                      dictating ? "text-red-600" : "text-neutral-400 hover:text-neutral-600"
                    )}
                  >
                    <Mic className={cn("size-4", dictating && "animate-pulse")} />
                  </button>
                </ComposerTooltip>
              )}
              <ComposerTooltip label="Voice mode">
                <button
                  type="button"
                  onClick={onVoice}
                  aria-label="Voice mode"
                  className="grid size-8 place-items-center rounded-lg text-neutral-400 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus-visible:ring-0"
                >
                  <AudioLines className="size-4" />
                </button>
              </ComposerTooltip>
              <ComposerTooltip label={busy ? "Stop" : "Send message"}>
                <button
                  type={busy ? "button" : "submit"}
                  onClick={busy ? onStop : undefined}
                  disabled={!busy && !canSend}
                  aria-label={busy ? "Stop generating" : "Send"}
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg outline-none transition-all duration-200 focus-visible:ring-0 motion-reduce:transition-none",
                    busy
                      ? accent
                        ? ACCENT[accent].send
                        : "bg-neutral-950 text-white hover:bg-neutral-800"
                      : canSend
                        ? cn(
                            "shadow-sm hover:shadow-md active:scale-95 motion-reduce:active:scale-100",
                            accent
                              ? ACCENT[accent].send
                              : "bg-neutral-950 text-white hover:bg-neutral-800"
                          )
                        : "cursor-not-allowed bg-neutral-200 text-neutral-400"
                  )}
                >
                  {busy ? <Square className="size-3 fill-white" /> : <ArrowUp className="size-4" />}
                </button>
              </ComposerTooltip>
            </div>
          </div>
        </TooltipProvider>
      </form>
      {/* CONTEXT TRAY — sits on the frame itself, below the input. No tint or
          border of its own: the gray frame already separates it from the white
          box above, and a second surface here would read as clutter.

          Always present, because it carries the mode switch, which has to stay
          reachable with nothing attached. Attachments and the quick action fill
          it out as they appear. */}
      <div className="px-2 pt-2.5 pb-1">
        {/* CONTROLS — first and therefore FIXED: attachments grow downward from
            here, so the mode switch never shifts under the cursor when a file
            lands. That was the whole problem with chips-on-top. */}
        <div className="flex items-center justify-between gap-2">
          <ModeMenu mode={mode} onSelectMode={onSelectMode} pill />
          {!hasChips && (
            <span className="truncate pr-1 text-[12px] text-neutral-400">
              Attach a file or pick a mode to get started
            </span>
          )}
        </div>

        {hasChips && (
          // ONE row that scrolls sideways, never a wrapping grid — 20 files used
          // to build a 5-row wall taller than the composer itself.
          <div className="sila-scroll -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1">
            {command && (
              <Chip icon={command.icon} label={command.label} onRemove={onRemoveCommand} />
            )}
            {agentTpl && (
              // Kimi-style: a small square card, slightly tilted, minimal info.
              <div
                title={agentTpl.chip_hint}
                className="-rotate-2 relative flex w-[5.5rem] origin-bottom-left flex-col items-center gap-1.5 rounded-2xl border border-primary/25 bg-white px-2 pt-3 pb-2 shadow-md transition-transform duration-200 hover:rotate-0"
              >
                <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </span>
                <span className="w-full truncate text-center font-medium text-[10.5px] text-neutral-800">
                  {agentTpl.name}
                </span>
                <button
                  type="button"
                  aria-label="Remove template"
                  onClick={onRemoveAgentTpl}
                  className="-top-1.5 -right-1.5 absolute grid size-5 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-400 shadow-sm hover:text-neutral-700"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            <SkillChips skills={skills} onRemove={onRemoveSkill} />
            {slideTpl && (
              // A SQUARE rounded card (senior-manager feedback: not a rectangle) —
              // thumbnail on top, name + length below, tilted until hover.
              <div className="-rotate-2 relative flex h-24 w-24 origin-bottom-left flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-md transition-transform duration-200 hover:rotate-0">
                {slideTpl.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slideTpl.thumb}
                    alt=""
                    className="h-12 w-full border-neutral-100 border-b object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-full place-items-center border-neutral-100 border-b bg-gradient-to-br from-neutral-100 to-neutral-200">
                    <Presentation className="size-4 text-neutral-500" />
                  </span>
                )}
                <span className="flex min-h-0 flex-1 flex-col justify-center px-2">
                  <span className="truncate font-medium text-[11px] text-neutral-800">
                    {slideTpl.name}
                  </span>
                  <span className="truncate text-[9.5px] text-neutral-400">
                    Slides · {slideTpl.count === "Auto" ? "auto" : `${slideTpl.count} slides`}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Remove template"
                  onClick={onRemoveSlideTpl}
                  className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-white/85 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            {(filesExpanded ? files : files.slice(0, VISIBLE_FILES)).map((f) => (
              <AttachCard key={f.id} chip={f} onRemove={() => onRemoveFile(f.id)} />
            ))}
            {!filesExpanded && files.length > VISIBLE_FILES && (
              <MoreFilesCard
                count={files.length - VISIBLE_FILES}
                onClick={() => setFilesExpanded(true)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Tooltip wrapper for a single composer control. */
function ComposerTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="bg-neutral-950 text-white">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

type CommandItem = { label: string; icon: LucideIcon; run: () => void };

/** Shared composer dropdown for the "+" and "/" buttons. */
function ComposerMenu({
  trigger,
  ariaLabel,
  items,
}: {
  trigger: React.ReactNode;
  ariaLabel: string;
  items: CommandItem[];
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={ariaLabel}
              className="grid size-8 place-items-center rounded-lg text-neutral-400 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-600 focus-visible:ring-0"
            >
              {trigger}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-neutral-950 text-white">
          {ariaLabel}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={10}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-60 rounded-2xl p-1.5"
      >
        {items.map(({ label, icon: Icon, run }) => (
          <DropdownMenuItem
            key={label}
            onSelect={run}
            className="gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-neutral-700"
          >
            <Icon className="size-4 text-neutral-500" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "+" — add input to the message: upload files (pinned as chips) or connectors. */
function ComposerToolsMenu({ onUpload }: { onUpload: () => void }) {
  const router = useRouter();
  const { currentId: ws } = useWorkspaces();
  const items: CommandItem[] = [
    { label: "Upload from computer", icon: Upload, run: onUpload },
    ...(ws
      ? [{ label: "Connectors", icon: Plug, run: () => router.push(ROUTES.connectors(ws)) }]
      : []),
  ];
  return <ComposerMenu ariaLabel="Add" trigger={<Plus className="size-4" />} items={items} />;
}

/** "/" — SILA action commands. Picking one pins a chip + tags the message. */
function ComposerSlashMenu({
  onPick,
  onAccountUsage,
  onUseTemplate,
  onAddSkill,
}: {
  onPick: (c: ActionCommand) => void;
  onAccountUsage: () => void;
  onUseTemplate: () => void;
  onAddSkill: () => void;
}) {
  const tSkills = useTranslations("sila.skills");
  const items: CommandItem[] = [
    { label: "Use a template", icon: Sparkles, run: onUseTemplate },
    { label: tSkills("add"), icon: ScrollText, run: onAddSkill },
    ...ACTION_COMMANDS.map((c) => ({ label: c.label, icon: c.icon, run: () => onPick(c) })),
    { label: "Account & Usage", icon: CircleUser, run: onAccountUsage },
  ];
  return (
    <ComposerMenu
      ariaLabel="Commands"
      trigger={<span className="font-medium text-[15px] leading-none">/</span>}
      items={items}
    />
  );
}
