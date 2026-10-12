"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ConnectorOut, type ResourceOptionOut, api } from "@/lib/api";
import { ConnectorIcon } from "@/lib/connector-icons";
import { ConnectCancelled, runConnect } from "@/lib/nango";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, LayoutGrid, List, Loader2, Plug, Search, Settings2, Unplug, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * WS-9 — "Connected apps": the Nango OAuth catalog. Connect runs the white-label
 * Connect UI (no token pasting), persists the binding, then opens a resource
 * picker (e.g. Slack channel) populated through Nango's proxy. A raw token never
 * reaches the browser. Rendered as an enterprise card grid or a compact list,
 * toggled by the user (persisted per browser).
 */

type ViewMode = "grid" | "list";
const VIEW_KEY = "sila:connectors-view";

type StatusFilter = "all" | "connected" | "available";

export function ConnectedApps({ workspaceId }: { workspaceId: string }) {
  const token = useToken();
  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  // Read the saved preference after mount (avoids an SSR/hydration mismatch).
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved === "grid" || saved === "list") setView(saved);
  }, []);
  const chooseView = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const { data: connectors, isLoading } = useQuery({
    queryKey: ["connectors", workspaceId],
    queryFn: () => api.connectors.list(workspaceId, token),
    enabled: !!token,
  });

  // Connected first, then alphabetical — the useful ones sit at the top.
  const sorted = useMemo(
    () =>
      [...(connectors ?? [])].sort(
        (a, b) => Number(b.connected) - Number(a.connected) || a.label.localeCompare(b.label)
      ),
    [connectors]
  );

  const categories = useMemo(
    () => Array.from(new Set(sorted.map((c) => connectorCategory(c.provider, c.label)))).sort(),
    [sorted]
  );

  // Search matches name / category / the value insight; the two selects narrow
  // by category and connection state. O(n) over the (small) catalog.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((c) => {
      if (status === "connected" && !c.connected) return false;
      if (status === "available" && c.connected) return false;
      const cat = connectorCategory(c.provider, c.label);
      if (category !== "all" && cat !== category) return false;
      if (!q) return true;
      return `${c.label} ${c.provider} ${cat} ${connectorInsight(c.provider, c.label)}`
        .toLowerCase()
        .includes(q);
    });
  }, [sorted, query, category, status]);

  if (!token || isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {["a", "b", "c"].map((k) => (
          <div
            key={`conn-skel-${k}`}
            className="h-32 animate-pulse rounded-xl border border-neutral-200 bg-neutral-50"
          />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) return null;
  const connectedCount = sorted.filter((c) => c.connected).length;
  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setStatus("all");
  };

  return (
    <div>
      {/* Filter bar — search + category + status, with the grid/list toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-neutral-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps…"
            className="h-9 rounded-lg pl-8"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-[150px] rounded-lg">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="h-9 w-[140px] rounded-lg">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="connected">Connected</SelectItem>
            <SelectItem value="available">Available</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3">
          <p className="hidden text-xs text-neutral-500 sm:block">
            <span className="font-semibold text-neutral-700">{connectedCount}</span> of{" "}
            {sorted.length} connected
          </p>
          <ViewToggle view={view} onChange={chooseView} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-6 py-12 text-center">
          <div className="grid size-10 place-items-center rounded-lg border border-neutral-200 bg-white text-neutral-400">
            <Search className="size-4" />
          </div>
          <p className="mt-3 text-sm font-medium text-neutral-700">No apps match your filters</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-800"
          >
            <X className="size-3" />
            Clear filters
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <ConnectorCard key={c.provider} workspaceId={workspaceId} connector={c} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {filtered.map((c) => (
            <ConnectorRow key={c.provider} workspaceId={workspaceId} connector={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
      {(
        [
          { id: "grid", Icon: LayoutGrid, label: "Card view" },
          { id: "list", Icon: List, label: "List view" },
        ] as const
      ).map(({ id, Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-label={label}
          aria-pressed={view === id}
          title={label}
          className={cn(
            "grid size-7 place-items-center rounded-md transition-colors",
            view === id
              ? "bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-200"
              : "text-neutral-400 hover:text-neutral-600"
          )}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}

/** Shared connect / revoke / resource-picker logic for both the card and the row. */
function useConnectorActions(workspaceId: string, connector: ConnectorOut) {
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [picker, setPicker] = useState<{ id: string; label: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["connectors", workspaceId] });

  const connect = useMutation({
    mutationFn: async () => {
      const session = await api.connectors.createSession(workspaceId, connector.provider, token);
      const connectionId = await runConnect(session.session_token);
      await api.connectors.persistBinding(workspaceId, connector.provider, connectionId, token);
    },
    onSuccess: () => {
      toast(`${connector.label} connected.`, "success");
      refresh();
      const first = connector.resource_pickers[0];
      if (first) setPicker(first);
    },
    onError: (err) => {
      if (err instanceof ConnectCancelled) return; // user closed the UI — no error toast
      toast(err instanceof Error ? err.message : "Connection failed", "error");
    },
  });

  const revoke = useMutation({
    mutationFn: () => api.connectors.revoke(workspaceId, connector.provider, token),
    onSuccess: () => {
      toast(`${connector.label} disconnected.`, "info");
      refresh();
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Revoke failed", "error"),
  });

  return { connect, revoke, picker, setPicker, refresh };
}

function ConnectorCard({
  workspaceId,
  connector,
}: {
  workspaceId: string;
  connector: ConnectorOut;
}) {
  const { connect, revoke, picker, setPicker, refresh } = useConnectorActions(
    workspaceId,
    connector
  );
  const chosen = pickerSummary(connector);
  const primaryPicker = connector.resource_pickers[0];

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col rounded-xl border bg-white p-4 transition-all",
          connector.connected
            ? "border-neutral-200 hover:border-neutral-300 hover:shadow-md"
            : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
        )}
      >
        {/* Header — brand tile + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-neutral-200 bg-white ring-1 ring-neutral-100/60">
            <ConnectorIcon name={connector.label} className="size-6" />
          </div>
          <StatusPill connected={connector.connected} />
        </div>

        {/* Identity + what SILA can do with it */}
        <div className="mt-3 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-semibold text-neutral-900">{connector.label}</p>
            <CategoryChip provider={connector.provider} label={connector.label} />
          </div>
          <p
            title={humanScopes(connector.scopes)}
            className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500"
          >
            {connectorInsight(connector.provider, connector.label)}
          </p>
          {connector.connected && chosen && (
            <p className="mt-1.5 truncate text-xs font-medium text-neutral-600">{chosen}</p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3">
          {connector.connected ? (
            <>
              {primaryPicker && (
                <Button variant="outline" size="sm" onClick={() => setPicker(primaryPicker)}>
                  <Settings2 className="size-3.5" />
                  {primaryPicker.label}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-neutral-500 hover:text-red-600"
                onClick={() => revoke.mutate()}
                disabled={revoke.isPending}
              >
                {revoke.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unplug className="size-3.5" />
                )}
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              className="bg-neutral-900 px-4 font-medium text-white hover:bg-neutral-800"
            >
              {connect.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plug className="size-3.5" />
              )}
              Connect
            </Button>
          )}
        </div>
      </div>

      {picker && (
        <ResourcePickerDialog
          workspaceId={workspaceId}
          provider={connector.provider}
          picker={picker}
          onClose={() => setPicker(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function ConnectorRow({
  workspaceId,
  connector,
}: {
  workspaceId: string;
  connector: ConnectorOut;
}) {
  const { connect, revoke, picker, setPicker, refresh } = useConnectorActions(
    workspaceId,
    connector
  );
  const chosen = pickerSummary(connector);
  const primaryPicker = connector.resource_pickers[0];

  return (
    <>
      <div className="flex items-center gap-3 border-neutral-100 border-b px-3.5 py-3 transition-colors last:border-b-0 hover:bg-neutral-50/70">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-neutral-200 bg-white">
          <ConnectorIcon name={connector.label} className="size-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-neutral-900">
              {connector.label}
            </span>
            <CategoryChip provider={connector.provider} label={connector.label} />
          </div>
          <span className="truncate text-xs text-neutral-500">
            {connectorInsight(connector.provider, connector.label)}
            {connector.connected && chosen ? ` · ${chosen}` : ""}
          </span>
        </div>
        <div className="hidden shrink-0 lg:block">
          <StatusPill connected={connector.connected} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {connector.connected ? (
            <>
              {primaryPicker && (
                <Button variant="ghost" size="sm" onClick={() => setPicker(primaryPicker)}>
                  <Settings2 className="size-3.5" />
                  <span className="hidden sm:inline">{primaryPicker.label}</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-500 hover:text-red-600"
                onClick={() => revoke.mutate()}
                disabled={revoke.isPending}
              >
                {revoke.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Unplug className="size-3.5" />
                )}
                <span className="hidden sm:inline">Disconnect</span>
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
              className="bg-neutral-900 font-medium text-white hover:bg-neutral-800"
            >
              {connect.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plug className="size-3.5" />
              )}
              Connect
            </Button>
          )}
        </div>
      </div>

      {picker && (
        <ResourcePickerDialog
          workspaceId={workspaceId}
          provider={connector.provider}
          picker={picker}
          onClose={() => setPicker(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <Check className="size-3" />
      Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
      <span className="size-1.5 rounded-full bg-neutral-300" />
      Not connected
    </span>
  );
}

function CategoryChip({ provider, label }: { provider: string; label: string }) {
  return (
    <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
      {connectorCategory(provider, label)}
    </span>
  );
}

// Functional category from the provider/label — a light-touch enterprise grouping
// signal (the brand is already in the icon). First match wins.
const CATEGORY: { match: string[]; label: string }[] = [
  { match: ["outlook-mail", "gmail", "email"], label: "Email" },
  { match: ["calendar"], label: "Calendar" },
  { match: ["sheets", "excel"], label: "Spreadsheet" },
  { match: ["docs", "word"], label: "Documents" },
  { match: ["onedrive", "drive", "sharepoint"], label: "Storage" },
  { match: ["slack", "teams", "chat", "discord", "telegram"], label: "Chat" },
  { match: ["powerbi", "power bi"], label: "Analytics" },
  { match: ["todo", "to do", "tasks"], label: "Tasks" },
  { match: ["contacts"], label: "Contacts" },
  { match: ["onenote", "forms", "powerpoint"], label: "Productivity" },
];

function connectorCategory(provider: string, label: string): string {
  const haystack = `${provider} ${label}`.toLowerCase();
  return CATEGORY.find((c) => c.match.some((m) => haystack.includes(m)))?.label ?? "App";
}

// What SILA can actually DO with each connection — the value the user gets,
// keyed by provider (exact), with a category fallback for anything unlisted.
const INSIGHTS: Record<string, string> = {
  "outlook-mail": "Let SILA read and send email, and pull requirements from your inbox.",
  "outlook-calendar": "Let SILA read your schedule and create calendar events.",
  "ms-teams": "Let SILA read channel messages and meeting transcripts to summarize them.",
  "ms-todo": "Let SILA create and track your tasks.",
  "ms-onenote": "Let SILA read and create notes.",
  "ms-onedrive": "Let SILA read your files and save its output back to OneDrive.",
  "ms-word": "Let SILA draft and read Word documents.",
  "ms-powerpoint": "Let SILA generate PowerPoint decks on your template.",
  "ms-excel": "Let SILA read your spreadsheets to analyze and chart the data.",
  "ms-sharepoint": "Let SILA read files and lists from your SharePoint sites.",
  powerbi: "Let SILA publish live dashboards to your Power BI from any data.",
  gmail: "Let SILA read and send email on your behalf.",
  "google-calendar": "Let SILA read your schedule and create calendar events.",
  "google-chat": "Let SILA post updates to your Google Chat spaces.",
  "google-contacts": "Let SILA look up people from your contacts.",
  "google-docs": "Let SILA draft and read Google Docs.",
  "google-drive": "Let SILA read your files and save its output back to Drive.",
  "google-forms": "Let SILA read form responses to summarize or chart them.",
  "google-sheets": "Let SILA read your sheets to analyze and build dashboards.",
  "google-tasks": "Let SILA create and track your tasks.",
  slack: "Let SILA post messages and updates to your channels.",
  clickup: "Let SILA create and track tasks in your workspace.",
};

const CATEGORY_INSIGHT: Record<string, string> = {
  Email: "Let SILA read and send email on your behalf.",
  Calendar: "Let SILA read your schedule and create events.",
  Spreadsheet: "Let SILA read your data to analyze and chart it.",
  Documents: "Let SILA draft and read documents.",
  Storage: "Let SILA read your files and save its output back.",
  Chat: "Let SILA post messages and updates for you.",
  Analytics: "Let SILA publish dashboards from your data.",
  Tasks: "Let SILA create and track your tasks.",
  Contacts: "Let SILA look up people from your contacts.",
  Productivity: "Let SILA read and create content for you.",
};

function connectorInsight(provider: string, label: string): string {
  return (
    INSIGHTS[provider] ??
    CATEGORY_INSIGHT[connectorCategory(provider, label)] ??
    "Let SILA use this app on your behalf."
  );
}

/** Humanized scope list ("Mail.Send · Mail.Read", not a wall of URLs). */
function humanScopes(scopes: string[]): string {
  const shown = scopes
    .filter((s) => s !== "offline_access")
    .map((s) => s.split("/").pop())
    .filter(Boolean);
  return shown.length ? shown.join(" · ") : "OAuth";
}

function ResourcePickerDialog({
  workspaceId,
  provider,
  picker,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  provider: string;
  picker: { id: string; label: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const token = useToken();
  const { toast } = useToast();
  const [value, setValue] = useState<string>("");

  const { data: options, isLoading } = useQuery({
    queryKey: ["connector-resources", workspaceId, provider, picker.id],
    queryFn: () => api.connectors.listResources(workspaceId, provider, picker.id, token),
    enabled: !!token,
  });

  const save = useMutation({
    mutationFn: (opt: ResourceOptionOut) =>
      api.connectors.saveResources(
        workspaceId,
        provider,
        { [picker.id]: { id: opt.value, label: opt.label } },
        token
      ),
    onSuccess: () => {
      toast(`${picker.label} saved.`, "success");
      onSaved();
      onClose();
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Could not save", "error"),
  });

  const chosen = options?.find((o) => o.value === value);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose a {picker.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Pick which {picker.label.toLowerCase()} this connection should use.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex h-10 items-center gap-2 text-sm text-neutral-500">
            <Loader2 className="size-4 animate-spin" />
            Loading {picker.label.toLowerCase()}s…
          </div>
        ) : (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder={`Select a ${picker.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {(options ?? []).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => chosen && save.mutate(chosen)}
            disabled={!chosen || save.isPending}
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function pickerSummary(connector: ConnectorOut): string | null {
  const parts: string[] = [];
  for (const p of connector.resource_pickers) {
    const sel = connector.selected_resources[p.id] as { label?: string } | undefined;
    if (sel?.label) parts.push(`${p.label}: ${sel.label}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
