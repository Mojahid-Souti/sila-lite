"use client";

import { TimeWheel, WheelSelect } from "@/components/agent/time-wheel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type AgentOut,
  type KBDocumentOut,
  type PublisherConfig,
  type PublisherDestination,
  api,
} from "@/lib/api";
import { type ScheduleSpec, type Unit, buildCron, parseCron } from "@/lib/cron";
import { SOVEREIGNTY_NOTE, describeAgent } from "@/lib/describe-agent";
import { formatSchedule } from "@/lib/schedule";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  FileText,
  Hash,
  Loader2,
  Lock,
  Mail,
  Plus,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const FREQ: { unit: Unit; label: string }[] = [
  { unit: "minutes", label: "Minutes" },
  { unit: "hours", label: "Hourly" },
  { unit: "days", label: "Daily" },
  { unit: "weeks", label: "Weekly" },
];
const TIMEZONES = ["Asia/Muscat", "Asia/Dubai", "Asia/Riyadh", "Europe/London", "UTC"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DAY_PRESET = {
  every: { label: "Every day", dow: [0, 1, 2, 3, 4, 5, 6] },
  weekdays: { label: "Weekdays", dow: [1, 2, 3, 4, 5] },
  weekend: { label: "Weekend", dow: [0, 6] },
  specific: { label: "Specific days", dow: [] as number[] },
} as const;
const DAY_PRESET_OPTIONS = Object.values(DAY_PRESET).map((p) => p.label);

/** Map the current day set to a preset label (anything non-canonical → "Specific days"). */
function presetLabel(dow: number[]): string {
  const s = [...dow].sort((a, b) => a - b).join(",");
  if (s === "0,1,2,3,4,5,6") return DAY_PRESET.every.label;
  if (s === "1,2,3,4,5") return DAY_PRESET.weekdays.label;
  if (s === "0,6") return DAY_PRESET.weekend.label;
  return DAY_PRESET.specific.label;
}

function formatBytes(n: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fileBadge(type: string): { label: string; cls: string } {
  const t = (type || "").toLowerCase();
  if (t.includes("pdf")) return { label: "PDF", cls: "bg-red-50 text-red-600 ring-red-100" };
  if (t.includes("doc")) return { label: "DOC", cls: "bg-blue-50 text-blue-600 ring-blue-100" };
  if (t.includes("md")) return { label: "MD", cls: "bg-purple-50 text-purple-600 ring-purple-100" };
  if (t.includes("htm"))
    return { label: "HTML", cls: "bg-orange-50 text-orange-600 ring-orange-100" };
  return { label: "TXT", cls: "bg-neutral-100 text-neutral-500 ring-neutral-200" };
}

function fileMeta(d: KBDocumentOut): string {
  return [d.file_type?.toUpperCase(), formatBytes(d.file_size), d.status]
    .filter(Boolean)
    .join(" · ");
}

/** Full-name day selector — a clean vertical list beside the time wheel (multi-select). */
function DayPicker({ dow, onToggle }: { dow: number[]; onToggle: (i: number) => void }) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-neutral-200">
      {DAY_FULL.map((name, i) => {
        const on = dow.includes(i);
        return (
          <button
            key={name}
            type="button"
            onClick={() => onToggle(i)}
            className={cn(
              "flex w-full items-center justify-between px-3 py-[6.5px] text-sm transition-colors",
              i > 0 && "border-t border-neutral-100",
              on ? "bg-neutral-900 font-medium text-white" : "text-neutral-600 hover:bg-neutral-50"
            )}
          >
            {name}
            {on && <Check className="size-3.5" />}
          </button>
        );
      })}
    </div>
  );
}

export function AgentConfigPanel({
  agent,
  workspaceId,
  onSaved,
}: {
  agent: AgentOut;
  workspaceId: string;
  onSaved?: () => void;
}) {
  const token = useToken();
  const qc = useQueryClient();
  const cfg = agent.publisher_config;
  const kbId = cfg?.kb_id ?? null;
  const slackDest = cfg?.destinations?.find((d) => d.type === "slack");
  const emailDest = cfg?.destinations?.find((d) => d.type === "email");
  // Destinations this panel can't edit yet (Gmail recipient, Google Sheet) are
  // preserved verbatim on save — a schedule/name edit must never drop them.
  const preservedDests =
    cfg?.destinations?.filter((d) => d.type !== "slack" && d.type !== "email") ?? [];

  const [name, setName] = useState(agent.name);
  const [spec, setSpec] = useState<ScheduleSpec>(() => parseCron(cfg?.schedule?.cron));
  const [tz, setTz] = useState(cfg?.schedule?.timezone ?? "Asia/Muscat");
  const [email, setEmail] = useState(emailDest?.to ?? "");
  const [slack, setSlack] = useState(
    slackDest
      ? { channel_id: slackDest.channel_id ?? "", channel_name: slackDest.channel_name ?? "" }
      : null
  );

  // Slack channels for the re-pick — only fetched when this agent posts to Slack and
  // the connector is live; a failure (not connected) falls back to read-only.
  const channelsQuery = useQuery({
    queryKey: ["slack-channels", workspaceId],
    queryFn: () => api.connectors.listResources(workspaceId, "slack", "channel", token as string),
    enabled: Boolean(slackDest && token),
    retry: false,
    staleTime: 60_000,
  });
  const channels = channelsQuery.data ?? [];
  const channelPickerReady = channelsQuery.isSuccess && channels.length > 0;
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [showCron, setShowCron] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);
  const [result, setResult] = useState<"saved" | "revet" | null>(null);

  const docsQuery = useQuery({
    queryKey: ["kbdocs", kbId],
    queryFn: () => api.kb.listDocuments(workspaceId, kbId as string, token as string),
    enabled: Boolean(kbId && token),
  });
  const liveDocs = docsQuery.data?.items ?? [];
  const remaining = liveDocs.filter((d) => !removed.has(d.id));
  const docsChanged = removed.size > 0;
  const canDelete = remaining.length > 1; // keep at least one document

  const set = (patch: Partial<ScheduleSpec>) => {
    setSpec((s) => ({ ...s, ...patch }));
    setResult(null);
  };
  const cron = buildCron(spec);
  const usingCron = Boolean(spec.custom.trim());
  const showInterval = !usingCron && spec.unit !== "weeks";
  const showTime = !usingCron && (spec.unit === "days" || spec.unit === "weeks");

  // Live plain-language summary — reflects the edits in progress, not just what's saved.
  const liveDestinations: PublisherDestination[] = [
    ...(slack?.channel_id
      ? [
          {
            type: "slack" as const,
            channel_id: slack.channel_id,
            channel_name: slack.channel_name,
          },
        ]
      : []),
    ...(email.trim() ? [{ type: "email" as const, to: email.trim() }] : []),
    ...preservedDests,
  ];
  const liveConfig: PublisherConfig = {
    schedule: { cron, timezone: tz },
    destinations: liveDestinations,
    docs: remaining.map((d) => d.filename),
    content: cfg?.content,
    kb_id: cfg?.kb_id,
  };

  const save = useMutation({
    mutationFn: async () => {
      for (const id of removed) {
        if (kbId) await api.kb.deleteDocument(workspaceId, kbId, id, token as string);
      }
      const destinations: PublisherDestination[] = [];
      if (slack?.channel_id)
        destinations.push({
          type: "slack",
          channel_id: slack.channel_id,
          channel_name: slack.channel_name,
        });
      if (email.trim()) destinations.push({ type: "email", to: email.trim() });
      destinations.push(...preservedDests);
      return api.agents.updateConfig(
        workspaceId,
        agent.id,
        {
          name: name !== agent.name ? name : undefined,
          schedule: { cron, timezone: tz },
          destinations,
          docs: remaining.map((d) => d.filename),
        },
        token as string
      );
    },
    onSuccess: (res) => {
      setRemoved(new Set());
      qc.invalidateQueries({ queryKey: ["agent", workspaceId, agent.id] });
      qc.invalidateQueries({ queryKey: ["agents", workspaceId] });
      qc.invalidateQueries({ queryKey: ["kbdocs", kbId] });
      setResult(res.revet ? "revet" : "saved");
      if (!res.revet) onSaved?.(); // schedule/destination edits close the modal
    },
  });

  if (!cfg) {
    return <p className="text-sm text-neutral-500">This agent has no editable schedule config.</p>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {/* What this agent does — a plain-language, model-free summary (updates live as
            you edit) so the owner reads it and a reviewer can audit it. */}
        <section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            What this agent does
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-800">
            {describeAgent(liveConfig)}
          </p>
          <div className="mt-2.5 flex items-start gap-1.5 border-neutral-200/70 border-t pt-2.5 text-[11px] text-neutral-400">
            <Lock className="mt-px size-3 shrink-0" />
            <span>{SOVEREIGNTY_NOTE}</span>
          </div>
        </section>

        {/* Name */}
        <section className="space-y-1.5">
          <Label htmlFor="agent-name" className="text-xs font-medium text-neutral-500">
            Agent name
          </Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setResult(null);
            }}
            className="text-base font-medium"
          />
        </section>

        {/* Schedule */}
        <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
          <SectionHeader icon={<Clock className="size-4" />} title="Schedule" />

          {/* Frequency segmented control */}
          <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-50 p-1">
            {FREQ.map((f) => {
              const active = !usingCron && spec.unit === f.unit;
              return (
                <button
                  key={f.unit}
                  type="button"
                  onClick={() => set({ unit: f.unit, custom: "" })}
                  className={cn(
                    "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800"
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {showInterval && (
            <div className="flex items-center gap-2.5 text-sm">
              <span className="text-neutral-500">Every</span>
              <Input
                type="number"
                min={1}
                value={spec.n}
                onChange={(e) => set({ n: Math.max(1, Number(e.target.value) || 1) })}
                className="w-20 text-center font-medium"
              />
              <span className="font-medium text-neutral-800">
                {spec.unit === "minutes" && (spec.n === 1 ? "minute" : "minutes")}
                {spec.unit === "hours" && (spec.n === 1 ? "hour" : "hours")}
                {spec.unit === "days" && (spec.n === 1 ? "day" : "days")}
              </span>
            </div>
          )}

          {showTime && (
            <div className="flex flex-wrap items-start gap-3 text-sm">
              {spec.unit === "weeks" && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-neutral-500">On these days</span>
                  <WheelSelect
                    options={DAY_PRESET_OPTIONS}
                    value={presetLabel(spec.dow)}
                    onChange={(v) => {
                      if (v === DAY_PRESET.every.label) set({ dow: [...DAY_PRESET.every.dow] });
                      else if (v === DAY_PRESET.weekdays.label)
                        set({ dow: [...DAY_PRESET.weekdays.dow] });
                      else if (v === DAY_PRESET.weekend.label)
                        set({ dow: [...DAY_PRESET.weekend.dow] });
                      else setDaysOpen(true); // "Specific days" → pick exact days
                    }}
                    className="w-44"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-neutral-500">Time</span>
                <TimeWheel
                  hour={spec.hour}
                  minute={spec.minute}
                  onChange={(h, m) => set({ hour: h, minute: m })}
                  className="w-44"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-neutral-500">Timezone</span>
                <WheelSelect
                  options={TIMEZONES}
                  value={tz}
                  onChange={(v) => {
                    setTz(v);
                    setResult(null);
                  }}
                  className="w-44"
                />
              </div>
            </div>
          )}

          {/* Live preview pill */}
          <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2.5">
            <CalendarClock className="size-4 shrink-0 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-700">{formatSchedule(cron, tz)}</span>
          </div>

          {/* Advanced cron disclosure */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowCron((v) => !v)}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
            >
              {showCron ? "Hide" : "Advanced —"} custom cron
            </button>
            {showCron && (
              <Input
                value={spec.custom}
                placeholder={cron}
                onChange={(e) => set({ custom: e.target.value })}
                className="font-mono text-xs"
              />
            )}
          </div>
        </section>

        {/* Destination */}
        <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
          <SectionHeader icon={<Send className="size-4" />} title="Destination" />
          {slackDest && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <Hash className="size-3.5" /> Slack channel
              </Label>
              {channelPickerReady ? (
                <Select
                  value={slack?.channel_id ?? ""}
                  onValueChange={(id) => {
                    const ch = channels.find((c) => c.value === id);
                    setSlack({ channel_id: id, channel_name: ch?.label ?? id });
                    setResult(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a channel" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {channels.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        #{c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                  <span className="grid size-6 place-items-center rounded bg-[#4A154B] text-white">
                    <Hash className="size-3" />
                  </span>
                  <span className="text-sm font-medium text-neutral-800">
                    #{slack?.channel_name ?? "channel"}
                  </span>
                  <span className="ml-auto text-xs text-neutral-400">
                    {channelsQuery.isLoading ? "loading channels…" : "reconnect Slack to change"}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-500"
            >
              <Mail className="size-3.5" /> Email recipient
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => {
                setEmail(e.target.value);
                setResult(null);
              }}
            />
          </div>
        </section>

        {/* Documents */}
        <section className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
          <SectionHeader
            icon={<FileText className="size-4" />}
            title="Documents"
            sub={remaining.length > 0 ? `${remaining.length} attached` : undefined}
          />
          {docsQuery.isLoading ? (
            <div className="h-16 animate-pulse rounded-xl bg-neutral-100" />
          ) : (
            <div className="space-y-2">
              {liveDocs.map((d) => {
                const isRemoved = removed.has(d.id);
                const badge = fileBadge(d.file_type);
                return (
                  <div
                    key={d.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                      isRemoved
                        ? "border-red-200 bg-red-50"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-lg text-[10px] font-bold ring-1",
                        badge.cls
                      )}
                    >
                      {badge.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          isRemoved ? "text-red-400 line-through" : "text-neutral-900"
                        )}
                      >
                        {d.filename}
                      </p>
                      <p className="truncate text-xs text-neutral-400">{fileMeta(d)}</p>
                    </div>
                    {isRemoved ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-neutral-500"
                        onClick={() =>
                          setRemoved((s) => {
                            const n = new Set(s);
                            n.delete(d.id);
                            return n;
                          })
                        }
                      >
                        <Undo2 className="size-3.5" /> Undo
                      </Button>
                    ) : canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${d.filename}`}
                        onClick={() => setRemoved((s) => new Set(s).add(d.id))}
                      >
                        <Trash2 className="size-4 text-neutral-400" />
                      </Button>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button variant="ghost" size="icon" disabled aria-label="Cannot remove">
                              <Trash2 className="size-4 text-neutral-300" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          An agent needs at least one document — add another before removing this
                          one.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })}
              {kbId && (
                <Link
                  href={`/workspaces/${workspaceId}/knowledge-base`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                >
                  <Plus className="size-4" /> Add documents
                </Link>
              )}
            </div>
          )}
        </section>

        {docsChanged && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Changing the documents alters what this agent can say, so it will go back to security
              review before it can run again.
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-neutral-100 pt-4">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Save changes
          </Button>
          {result === "saved" && <span className="text-sm text-green-700">Saved.</span>}
          {result === "revet" && (
            <span className="text-sm text-amber-800">Saved — sent back to security review.</span>
          )}
          {save.isError && <span className="text-sm text-red-700">Couldn't save. Try again.</span>}
        </div>

        {/* "Specific days" → a small centered modal over the edit dialog */}
        <Dialog open={daysOpen} onOpenChange={setDaysOpen}>
          <DialogContent className="rounded-2xl sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>Pick days</DialogTitle>
            </DialogHeader>
            <DayPicker
              dow={spec.dow}
              onToggle={(i) =>
                set({
                  dow: spec.dow.includes(i) ? spec.dow.filter((x) => x !== i) : [...spec.dow, i],
                })
              }
            />
            <Button onClick={() => setDaysOpen(false)} className="w-full">
              Done
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function SectionHeader({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-neutral-100 text-neutral-600">
        {icon}
      </span>
      <span className="text-sm font-semibold text-neutral-900">{title}</span>
      {sub && <span className="text-xs text-neutral-400">· {sub}</span>}
    </div>
  );
}
