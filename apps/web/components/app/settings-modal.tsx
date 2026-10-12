"use client";

import { UsageDemoPanel } from "@/components/app/usage-demo-panel";
import { useWorkspaces } from "@/components/app/workspace-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkspaceRole } from "@/components/workspace/use-workspace-role";
import { api } from "@/lib/api";
import { refreshTokens } from "@/lib/auth-refresh";
import { ROUTES } from "@/lib/constants";
import { DEMO_USAGE } from "@/lib/demo-flags";
import { ME_QUERY_KEY, type Me, useMe } from "@/lib/use-me";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  Bot,
  Building2,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  Search,
  Settings,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/**
 * The account modal — Claude-style: a searchable left rail, a scrolling content
 * pane, one centred surface. Replaces the two account-menu entries that used to
 * navigate away to `/workspaces/{id}` and `/workspaces/{id}/settings`; the
 * routes still exist and still work, they are simply no longer linked from here.
 *
 * Nothing in this file is an authorization boundary. Admin-only panels are
 * hidden from the rail for tidiness, but RLS and OPA remain the real gate — a
 * non-admin who reaches an admin endpoint directly is still refused.
 */

type SectionId = "dashboard" | "account" | "workspace" | "notifications" | "support";

type Section = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  group: "Workspace" | "Account";
  adminOnly?: boolean;
  /** Matched against the search box alongside the label. */
  keywords: string;
};

const SECTIONS: Section[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "Workspace",
    keywords: "overview agents members stats metrics",
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: Building2,
    group: "Workspace",
    adminOnly: true,
    keywords: "settings members roles danger developer api keys",
  },
  {
    id: "account",
    label: "Account",
    icon: User,
    group: "Account",
    keywords: "profile email name identity sign out",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    group: "Account",
    keywords: "alerts email digest",
  },
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    group: "Account",
    keywords: "help docs contact",
  },
];

export function SettingsModal({
  open,
  onOpenChange,
  initial = "dashboard",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: SectionId;
}) {
  const [active, setActive] = useState<SectionId>(initial);
  const [query, setQuery] = useState("");
  const { currentId } = useWorkspaces();
  const { role } = useWorkspaceRole(currentId ?? "");
  const isAdmin = role === "admin";

  // O(n) over a fixed handful of sections — n is the array above, not user data.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SECTIONS.filter((s) => !s.adminOnly || isAdmin).filter(
      (s) => !q || s.label.toLowerCase().includes(q) || s.keywords.includes(q)
    );
  }, [query, isAdmin]);

  const groups = useMemo(() => {
    const by = new Map<Section["group"], Section[]>();
    for (const s of visible) by.set(s.group, [...(by.get(s.group) ?? []), s]);
    return [...by.entries()];
  }, [visible]);

  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The usage dashboard needs width for two charts and a four-column table;
          the settings panels do not. DEMO_USAGE widens it only while recording. */}
      <DialogContent
        className={cn(
          "h-[min(78vh,660px)] gap-0 overflow-hidden p-0",
          DEMO_USAGE && active === "dashboard" ? "sm:max-w-6xl" : "sm:max-w-4xl"
        )}
      >
        <DialogTitle className="sr-only">Account and workspace</DialogTitle>
        <DialogDescription className="sr-only">
          Workspace overview, account details and preferences.
        </DialogDescription>
        <div className="flex h-full min-h-0">
          {/* RAIL */}
          <aside className="flex w-60 shrink-0 flex-col border-neutral-200 border-r bg-neutral-50/70">
            <div className="relative p-3">
              <Search className="-translate-y-1/2 absolute top-1/2 left-6 size-4 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full rounded-lg border border-neutral-200 bg-white py-2 pr-3 pl-9 text-sm outline-none transition-colors focus:border-neutral-300"
              />
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {groups.length === 0 && (
                <p className="px-3 py-6 text-center text-neutral-400 text-sm">No matches</p>
              )}
              {groups.map(([group, items]) => (
                <div key={group} className="mb-3">
                  <p className="px-3 pb-1 font-medium text-[11px] text-neutral-400 uppercase tracking-wider">
                    {group}
                  </p>
                  {items.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActive(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        active === s.id
                          ? "bg-neutral-200/70 font-medium text-neutral-900"
                          : "text-neutral-600 hover:bg-neutral-200/50"
                      )}
                    >
                      <s.icon className="size-4 shrink-0" />
                      {s.label}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </aside>

          {/* PANE */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Settings read as a column, so they cap at 2xl. The usage
                dashboard is a grid of charts and a six-column table — capped at
                2xl it stayed 672px wide however wide the modal grew, which is
                why the donut legend truncated to "OMI…". */}
            <div
              className={cn(
                "mx-auto py-7",
                DEMO_USAGE && active === "dashboard" ? "max-w-none px-5 sm:px-7" : "max-w-2xl px-8"
              )}
            >
              <h2 className="mb-6 font-semibold text-[19px] text-neutral-900">{current.label}</h2>
              {active === "dashboard" &&
                (DEMO_USAGE ? (
                  <UsageDemoPanel />
                ) : (
                  <DashboardPanel onNavigate={() => onOpenChange(false)} />
                ))}
              {active === "account" && <AccountPanel />}
              {active === "workspace" && <WorkspacePanel onNavigate={() => onOpenChange(false)} />}
              {active === "notifications" && (
                <Placeholder text="Notification preferences aren't wired up yet. Nothing is sent today beyond account email — verification and password resets." />
              )}
              {active === "support" && (
                <Placeholder text="Support routing isn't wired up yet. For now, raise issues with your workspace admin." />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-neutral-100 border-b py-3.5 last:border-0">
      <span className="text-[14px] text-neutral-600">{label}</span>
      <span className="text-right text-[14px] text-neutral-900">{children}</span>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-neutral-200 border-dashed px-4 py-6 text-[14px] text-neutral-500 leading-relaxed">
      {text}
    </p>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: { icon: LucideIcon; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <Icon className="mb-2 size-4 text-neutral-400" />
      <p className="font-semibold text-2xl text-neutral-900 leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-[12.5px] text-neutral-500">{label}</p>
    </div>
  );
}

/** The former `/workspaces/{id}` overview, inline. Reuses the same queries and
 *  cache keys as the route, so opening this costs nothing when the app already
 *  loaded them. */
function DashboardPanel({ onNavigate }: { onNavigate: () => void }) {
  const token = useToken();
  const { currentId } = useWorkspaces();
  const wid = currentId ?? "";

  const { data: agents } = useQuery({
    queryKey: ["agents", wid],
    queryFn: () => api.agents.list(wid, token),
    enabled: !!token && !!wid,
  });
  const { data: members } = useQuery({
    queryKey: ["workspace-members", wid],
    queryFn: () => api.workspaces.members.list(wid, token),
    enabled: !!token && !!wid,
  });

  if (!wid) {
    return <Placeholder text="Pick a workspace first — the overview is scoped to one." />;
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={Bot} label="Agents" value={agents?.total ?? 0} />
        <Stat icon={Users} label="Members" value={members?.length ?? 0} />
        <Stat icon={BookOpen} label="Knowledge bases" value="—" />
      </div>
      <div>
        <p className="mb-2 font-medium text-[13px] text-neutral-500">Jump to</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { href: ROUTES.myAgents, label: "My agents", icon: Bot },
            { href: ROUTES.bazaar, label: "Browse the Bazaar", icon: Building2 },
            { href: ROUTES.knowledgeHome, label: "Knowledge", icon: BookOpen },
            { href: ROUTES.connectorsHome, label: "Connectors", icon: Settings },
          ].map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={onNavigate}
              className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-[14px] text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
            >
              <l.icon className="size-4 text-neutral-400" />
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountPanel() {
  const { me } = useMe();
  const { currentId } = useWorkspaces();
  const { role } = useWorkspaceRole(currentId ?? "");
  const token = useToken();
  const queryClient = useQueryClient();

  // The name shown used to be DERIVED from the email handle, so it could not be
  // changed and was wrong for anyone whose address is not their name.
  const stored = me?.full_name?.trim() ?? "";
  const [name, setName] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The field follows the server once `me` arrives, unless the user is mid-edit.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setName(stored);
  }, [stored, touched]);

  const trimmed = name.trim();
  const dirty = trimmed !== stored;
  const tooShort = trimmed.length > 0 && trimmed.length < 2;

  const save = async () => {
    if (!token || !dirty || tooShort) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.auth.updateProfile(trimmed, token);
      // The name lives in the JWT's user_metadata claim, and the access token in
      // hand was minted BEFORE this write — so it still carries the old name.
      // Refreshing mints a token with the new claim, which is what the greeting
      // reads and what `/auth/me` echoes back. Without this the save persists but
      // nothing on screen changes, and a reload appears to discard it.
      await refreshTokens();
      await queryClient.invalidateQueries();
      // The refetch above may have run before React handed the query the new
      // token, in which case it echoed the OLD claim back into the cache. The
      // PATCH response is authoritative, so it settles the name last. Merged,
      // not replaced, to leave the rest of the cached identity intact.
      queryClient.setQueryData<Me | undefined>(ME_QUERY_KEY, (prev) =>
        prev ? { ...prev, full_name: updated.full_name } : prev
      );
      setTouched(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your name.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="border-neutral-100 border-b py-3.5">
        <label htmlFor="account-name" className="mb-2 block text-[14px] text-neutral-600">
          Name
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="account-name"
            value={name}
            maxLength={60}
            placeholder="Your name"
            onChange={(e) => {
              setTouched(true);
              setName(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            className="h-9 max-w-xs text-[14px]"
          />
          {/* Secondary, and the same height as the field it sits beside — a
              filled primary at button height read as the page's main action
              when it only renames one row. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-lg px-3.5"
            onClick={() => void save()}
            disabled={!dirty || tooShort || saving}
          >
            {saving ? "Saving…" : saved ? "Saved" : "Save"}
          </Button>
        </div>
        {tooShort && <p className="mt-1.5 text-[12px] text-red-600">Use at least 2 characters.</p>}
        {error && <p className="mt-1.5 text-[12px] text-red-600">{error}</p>}
      </div>
      <Row label="Email">{me?.email ?? "—"}</Row>
      <Row label="Role in this workspace">
        <span className="capitalize">{role ?? "—"}</span>
      </Row>
    </div>
  );
}

function WorkspacePanel({ onNavigate }: { onNavigate: () => void }) {
  const { currentId } = useWorkspaces();
  if (!currentId) return <Placeholder text="No workspace selected." />;
  return (
    <div className="space-y-2">
      {[
        { href: ROUTES.workspaceSettings(currentId), label: "General settings" },
        { href: ROUTES.workspaceMembers(currentId), label: "Members and roles" },
      ].map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={onNavigate}
          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-[14px] text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          {l.label}
          <span className="text-neutral-300">→</span>
        </Link>
      ))}
    </div>
  );
}
