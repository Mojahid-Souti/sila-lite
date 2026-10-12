import type { BazaarRequirements, PublisherConfig, PublisherDestination } from "@/lib/api";
import { formatSchedule } from "@/lib/schedule";

// The sovereignty wedge, made legible (not backend trivia): the one thing a cloud
// assistant can't honestly say. Shown on the card + the edit surface.
export const SOVEREIGNTY_NOTE =
  "Runs on your own infrastructure — your documents, tokens, and AI stay in this workspace and never leave.";

function destPhrase(d: PublisherDestination): string {
  if (d.type === "slack") return `#${d.channel_name ?? "your channel"}`;
  if (d.type === "google-sheets") return "your Google Sheet";
  if (d.type === "google-chat") return "your Google Chat space";
  if (d.type === "google-tasks") return "your Google Tasks list";
  if (d.type === "google-docs") return "a new Google Doc";
  if (d.type === "google-calendar") return "your Google Calendar";
  if (d.type === "outlook-calendar") return "your Outlook Calendar";
  if (d.type === "ms-teams") return "your Teams channel";
  if (d.type === "ms-todo") return "your To Do list";
  if (d.type === "ms-onenote") return "your OneNote";
  if (d.type === "ms-onedrive") return "your OneDrive";
  if (d.type === "ms-excel") return "your Excel file";
  if (d.type === "ms-word") return "a Word document";
  if (d.type === "ms-powerpoint") return "a slide deck";
  return d.to; // email + gmail + outlook-mail carry the recipient
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

/**
 * A plain-language, MODEL-FREE description of what a built workflow agent does —
 * legible for the owner and auditable by a reviewer. Pure template over the
 * publisher_config (no LLM call), so it's deterministic and always accurate to the
 * saved settings. Returns "" for agents without a config (nothing to describe).
 */
export function describeAgent(cfg: PublisherConfig | null | undefined): string {
  if (!cfg) return "";
  const docs = cfg.docs ?? [];
  const dests = (cfg.destinations ?? []).map(destPhrase).filter(Boolean);
  const content = (cfg.content ?? "").trim().slice(0, 140);
  const schedule = cfg.schedule?.cron
    ? formatSchedule(cfg.schedule.cron, cfg.schedule.timezone ?? undefined)
    : "";

  const clauses: string[] = [];
  if (docs.length === 1) clauses.push(`reads ${docs[0]}`);
  else if (docs.length > 1) clauses.push(`reads ${docs.length} documents`);

  const action = content ? `generates ${lowerFirst(content)}` : "writes a short summary";
  clauses.push(schedule ? `${action} ${lowerFirst(schedule)}` : action);

  if (dests.length) clauses.push(`posts it to ${joinList(dests)}`);

  return `This agent ${joinList(clauses)}.`;
}

const PROVIDER_PHRASES: Record<string, string> = {
  slack: "posts to your Slack",
  gmail: "sends from your Gmail",
  "outlook-mail": "sends from your Outlook",
  "google-sheets": "writes to your Google Sheet",
  "google-chat": "posts to your Google Chat",
  "google-docs": "writes Google Docs",
  "google-calendar": "creates calendar events",
  "google-tasks": "creates tasks",
};

/**
 * The Bazaar-listing sibling of describeAgent: a plain-language line over the
 * SANITIZED requirements shape (provider types + counts — never the
 * publisher's targets or filenames). Deterministic template, no LLM.
 */
export function describeListing(req: BazaarRequirements): string {
  const clauses: string[] = [];
  if (req.data_mode === "included" && req.docs_count > 0) {
    clauses.push(
      `comes with ${req.docs_count} document${req.docs_count === 1 ? "" : "s"} included`
    );
  } else if (req.docs_count > 0) {
    clauses.push("grounds its answers in documents you attach");
  }
  const content = (req.content ?? "").trim().slice(0, 140);
  const schedule = req.schedule?.cron
    ? formatSchedule(req.schedule.cron, req.schedule.timezone ?? undefined)
    : "";
  const action = content ? `generates ${lowerFirst(content)}` : "writes a short summary";
  clauses.push(schedule ? `${action} ${lowerFirst(schedule)}` : action);
  const outs = req.requires.map((p) => PROVIDER_PHRASES[p] ?? `uses your ${p}`);
  if (req.needs_email_recipient) outs.push("emails you");
  if (outs.length) clauses.push(joinList(outs));
  return `This agent ${joinList(clauses)}.`;
}
