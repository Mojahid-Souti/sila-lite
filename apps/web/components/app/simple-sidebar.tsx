"use client";

import { SilaGlyph, SilaLockup } from "@/components/app/sila/sila-brand";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/constants";
import { useToken } from "@/lib/use-token";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Bot,
  Check,
  type LucideIcon,
  MessagesSquare,
  Plug,
  Plus,
  Search,
  SlidersHorizontal,
  Store,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AccountMenu } from "./account-menu";
import { useSidebar } from "./sidebar-context";
import { useWorkspaces } from "./workspace-context";
import { WorkspaceSwitcher } from "./workspace-switcher";

/**
 * The end-user (agent-first) shell sidebar — Claude-style. A "New session"
 * button + recents up top, a Workspace switcher (connectors are scoped per
 * workspace), then a short Library (Knowledge, Connectors, Bazaar). Support
 * lives in the profile menu. White background to match the main surface; the
 * orb's blue/orange shows only on the brand/avatar squares. Rendered for
 * ux_mode = "simple".
 */
export function SimpleSidebar() {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const { currentId: ws } = useWorkspaces();
  const [groupBy, setGroupBy] = useState("none");
  // Owned here, not in RecentsList, because two things open the same modal:
  // the Search row above and "See all chats" at the bottom of Recents.
  const [searchOpen, setSearchOpen] = useState(false);

  const utilities: { href: string; icon: LucideIcon; label: string; disabled?: boolean }[] = [
    {
      href: ROUTES.knowledgeHome,
      icon: BookOpen,
      label: "Knowledge",
      disabled: !ws,
    },
    // Connectors stays in THIS shell (/connectors) — the workspace route would
    // swap in the operator sidebar, which Simple users shouldn't see.
    { href: ROUTES.connectorsHome, icon: Plug, label: "Connectors", disabled: !ws },
    { href: ROUTES.bazaar, icon: Store, label: "Bazaar" },
    { href: ROUTES.myAgents, icon: Bot, label: "My agents" },
  ];

  const isActive = (href: string) =>
    href !== "#" && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-neutral-200 bg-white transition-[width] duration-300 ease-in-out",
          collapsed ? "w-[64px]" : "w-[256px]"
        )}
        data-collapsed={collapsed}
      >
        {/* Brand — the official Sila lockup (icon + wordmark); just the mark when collapsed. */}
        <div className="flex h-14 items-center border-b border-neutral-200 px-3">
          <Link
            href={ROUTES.dashboard}
            className="flex items-center rounded-md p-1 transition-colors hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
          >
            {collapsed ? <SilaGlyph className="size-8" /> : <SilaLockup className="h-9 w-auto" />}
          </Link>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-2">
          {/* New + Search chats — the two things you reach for most, so they sit
              above the workspace switcher. Both read as quiet rows: the ringed
              glyph carries the affordance, not a filled button. */}
          <div className="space-y-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={ROUTES.dashboard}
                  className={cn(
                    "flex h-10 items-center rounded-lg text-neutral-800 text-sm transition-colors hover:bg-neutral-100",
                    collapsed ? "justify-center" : "gap-2.5 px-2"
                  )}
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border border-neutral-300 text-neutral-600">
                    <Plus className="size-3.5" />
                  </span>
                  {!collapsed && <span>New</span>}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-neutral-950 text-white">
                Start a new session
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className={cn(
                    "flex h-10 w-full items-center rounded-lg text-neutral-800 text-sm transition-colors hover:bg-neutral-100",
                    collapsed ? "justify-center" : "gap-2.5 px-2"
                  )}
                >
                  <span className="grid size-6 shrink-0 place-items-center text-neutral-600">
                    <Search className="size-4" />
                  </span>
                  {!collapsed && <span>Search chats</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-neutral-950 text-white">
                Search chats
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Workspace — tools/connectors are scoped per workspace, so the
              switcher matters (no avatar squares per the design). */}
          <div className="space-y-1.5">
            {!collapsed && <SectionLabel>Workspace</SectionLabel>}
            <WorkspaceSwitcher collapsed={collapsed} showAvatar={false} />
          </div>

          {/* Library */}
          <div className="space-y-0.5">
            {!collapsed && <SectionLabel>Library</SectionLabel>}
            {utilities.map((item) => (
              <SidebarLink
                key={item.label}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={isActive(item.href)}
                collapsed={collapsed}
                disabled={item.disabled}
              />
            ))}
          </div>

          {/* Recents. Always mounted — it owns the all-chats modal that the
              Search row opens, which must work while collapsed too; the list
              itself hides at that width. */}
          <div className="space-y-1">
            {!collapsed && (
              <div className="flex items-center justify-between px-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                  Recents
                </span>
                <GroupByMenu value={groupBy} onChange={setGroupBy} />
              </div>
            )}
            <RecentsList
              collapsed={collapsed}
              allChatsOpen={searchOpen}
              onAllChatsOpenChange={setSearchOpen}
            />
          </div>
        </nav>

        {/* Account */}
        <div className="border-t border-neutral-200 p-2">
          <AccountMenu collapsed={collapsed} />
        </div>
      </aside>
    </TooltipProvider>
  );
}

type SessionRow = { id: string; title: string; started_at: string };

// The sidebar shows this many; the rest live behind "See all chats".
const RECENTS_SHOWN = 8;

/** Full chat history in a centered modal: search on top, every session with its
 *  creation date below. Click navigates to the session.
 *
 *  Doubles as the bulk-delete surface — "Select" turns the rows into
 *  checkboxes so a run of chats goes in one confirmed action instead of eight
 *  hover-and-click deletions. Selection is kept as a Set of ids, so toggling
 *  and the "is this row selected?" render check are both O(1); filtering the
 *  list is O(n) over the loaded sessions (n <= the list cap, currently 30).
 */
function AllChatsModal({
  open,
  onClose,
  sessions,
  activeId,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  sessions: SessionRow[];
  activeId: string | null;
  /** Called with the ids the server actually removed, so the parent can prune
   *  its own list and leave the session if the open one was deleted. */
  onDeleted: (ids: string[]) => void;
}) {
  const token = useToken();
  const [query, setQuery] = useState("");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? sessions.filter((s) => (s.title || "Untitled").toLowerCase().includes(q))
    : sessions;

  // "Select all" acts on what you can currently SEE — selecting rows hidden by
  // the search filter would delete chats the user never laid eyes on.
  const allVisibleSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const reset = useCallback(() => {
    setQuery("");
    setSelecting(false);
    setSelected(new Set());
    setConfirming(false);
  }, []);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  async function confirmDelete() {
    if (!token || selected.size === 0) return;
    const ids = [...selected];
    setBusy(true);
    try {
      await api.sila.deleteSessions(ids, token);
      onDeleted(ids);
      reset();
    } catch {
      // Leave the selection intact so the user can retry rather than losing it.
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${day} · ${time}`;
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            reset();
            onClose();
          }
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-neutral-100 border-b px-4 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>All chats</DialogTitle>
              {sessions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelecting((v) => !v);
                    setSelected(new Set());
                  }}
                  className="mr-6 shrink-0 rounded-md px-2 py-1 text-neutral-500 text-sm transition-colors hover:bg-neutral-100 hover:text-neutral-800"
                >
                  {selecting ? "Cancel" : "Select"}
                </button>
              )}
            </div>
            <DialogDescription className="sr-only">
              Search, open, or select and delete your SILA sessions.
            </DialogDescription>
            <div className="relative mt-2">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats…"
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pr-3 pl-9 text-sm outline-none transition-colors focus:border-neutral-300 focus:bg-white"
              />
            </div>
            {selecting && (
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      for (const s of filtered) {
                        if (allVisibleSelected) {
                          next.delete(s.id);
                        } else {
                          next.add(s.id);
                        }
                      }
                      return next;
                    })
                  }
                  className="rounded-md px-2 py-1 text-neutral-600 text-sm transition-colors hover:bg-neutral-100"
                >
                  {allVisibleSelected ? "Clear all" : `Select all${q ? " shown" : ""}`}
                </button>
                <span className="text-neutral-500 text-sm tabular-nums">
                  {selected.size} selected
                </span>
              </div>
            )}
          </DialogHeader>

          <ul className="h-[55vh] overflow-y-auto p-2">
            {filtered.length === 0 && (
              <li className="grid h-full place-items-center text-neutral-400 text-sm">
                No chats match
              </li>
            )}
            {filtered.map((s) => {
              const checked = selected.has(s.id);
              const label = s.title || "Untitled";
              const row = (
                <>
                  {selecting && (
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-4 shrink-0 place-items-center rounded border transition-colors",
                        checked ? "border-neutral-900 bg-neutral-900" : "border-neutral-300"
                      )}
                    >
                      {checked && <Check className="size-3 text-white" />}
                    </span>
                  )}
                  <span
                    className={cn(
                      "truncate text-neutral-800 text-sm",
                      !s.title && "text-neutral-400"
                    )}
                  >
                    {label}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-neutral-400 tabular-nums">
                    {fmt(s.started_at)}
                  </span>
                </>
              );
              const rowCls = cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-100",
                (selecting ? checked : activeId === s.id) && "bg-neutral-100"
              );
              return (
                <li key={s.id}>
                  {selecting ? (
                    // In selection mode the row must NOT navigate — a stray click
                    // would drop the selection and leave the modal.
                    <button
                      type="button"
                      onClick={() => toggle(s.id)}
                      aria-pressed={checked}
                      aria-label={`${checked ? "Deselect" : "Select"} ${label}`}
                      className={rowCls}
                    >
                      {row}
                    </button>
                  ) : (
                    <Link
                      href={`${ROUTES.dashboard}?session=${s.id}`}
                      onClick={() => {
                        reset();
                        onClose();
                      }}
                      className={rowCls}
                    >
                      {row}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          {selecting && selected.size > 0 && (
            <div className="flex items-center justify-between gap-3 border-neutral-100 border-t px-4 py-3">
              <span className="text-neutral-500 text-sm">
                {selected.size} chat{selected.size === 1 ? "" : "s"} selected
              </span>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 font-medium text-sm text-white transition-colors hover:bg-red-700"
              >
                <Trash2 className="size-4" />
                Delete ({selected.size})
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation. Sibling of the list dialog rather than nested, so closing
          one never unmounts the other mid-action. */}
      <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Delete {selected.size} chat{selected.size === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This permanently removes {selected.size === 1 ? "the session" : "these sessions"} and
              all their messages. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-neutral-500 text-sm hover:text-neutral-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-4 font-medium text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The Recents history — the user's SILA sessions. Click to resume (via the
 *  `?session=` param the chat reads), hover to delete. Polls so a brand-new
 *  session shows up shortly after its first message. */
function RecentsList({
  collapsed,
  allChatsOpen,
  onAllChatsOpenChange,
}: {
  collapsed: boolean;
  allChatsOpen: boolean;
  onAllChatsOpenChange: (open: boolean) => void;
}) {
  const token = useToken();
  const searchParams = useSearchParams();
  const activeId = searchParams.get("session");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;
    api.sila
      .listSessions(token)
      .then((r) => setSessions(r.sessions))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  /** True if any of `ids` is the session the user is currently in. The live
   *  session is the URL's ?session OR the one in sessionStorage, because a
   *  brand-new session has no ?session param yet. O(n) over the ids. */
  const includesActive = useCallback(
    (ids: string[]) => {
      let storageActive: string | null = null;
      try {
        storageActive = sessionStorage.getItem("sila:active-session");
      } catch {
        /* unavailable */
      }
      return ids.some((id) => activeId === id || storageActive === id);
    },
    [activeId]
  );

  /** Leave the deleted session: clear the handle and hard-navigate so the chat
   *  fully resets to the new-session view (a router.push wouldn't reset a
   *  URL-less new session). */
  const leaveDeletedSession = useCallback(() => {
    try {
      sessionStorage.removeItem("sila:active-session");
    } catch {
      /* unavailable */
    }
    window.location.assign(ROUTES.dashboard);
  }, []);

  /** Prune the rows the bulk delete removed; the request already succeeded. */
  const onBulkDeleted = useCallback(
    (ids: string[]) => {
      const gone = new Set(ids);
      setSessions((prev) => prev.filter((x) => !gone.has(x.id)));
      if (includesActive(ids)) leaveDeletedSession();
    },
    [includesActive, leaveDeletedSession]
  );

  async function remove(id: string) {
    setConfirmId(null);
    if (!token) return;
    const isActive = includesActive([id]);
    setSessions((s) => s.filter((x) => x.id !== id));
    await api.sila.deleteSession(id, token).catch(() => {});
    if (isActive) {
      leaveDeletedSession();
    }
  }

  const modal = (
    <AllChatsModal
      open={allChatsOpen}
      onClose={() => onAllChatsOpenChange(false)}
      sessions={sessions}
      activeId={activeId}
      onDeleted={onBulkDeleted}
    />
  );

  // Collapsed: the modal is the only thing this component still contributes.
  if (collapsed) return modal;
  if (sessions.length === 0) {
    return (
      <>
        <p className="px-2 text-sm text-neutral-400">No recent chats yet</p>
        {modal}
      </>
    );
  }
  return (
    <>
      <ul className="space-y-0.5">
        {sessions.slice(0, RECENTS_SHOWN).map((s) => {
          const active = activeId === s.id;
          return (
            <li key={s.id} className="group relative">
              <Link
                href={`${ROUTES.dashboard}?session=${s.id}`}
                title={s.title || "Untitled"}
                className={cn(
                  "block truncate rounded-lg py-1.5 pr-7 pl-2 text-sm transition-colors",
                  active
                    ? "bg-neutral-100 text-neutral-900"
                    : "text-neutral-600 hover:bg-neutral-100",
                  // No AI title yet → "Untitled", gently pulsing until it's named.
                  !s.title && "animate-pulse text-neutral-400"
                )}
              >
                {s.title || "Untitled"}
              </Link>
              <button
                type="button"
                onClick={() => setConfirmId(s.id)}
                aria-label="Delete session"
                className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-md text-neutral-400 opacity-0 transition hover:bg-neutral-200 hover:text-neutral-700 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {sessions.length > RECENTS_SHOWN && (
        <button
          type="button"
          onClick={() => onAllChatsOpenChange(true)}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-neutral-400 text-sm transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <MessagesSquare className="size-3.5" />
          See all chats ({sessions.length})
        </button>
      )}
      {modal}
      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              This permanently removes the session and its messages.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmId(null)}
              className="rounded-lg px-3 py-2 text-neutral-500 text-sm hover:text-neutral-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmId && remove(confirmId)}
              className="inline-flex h-9 items-center rounded-lg bg-red-600 px-4 font-medium text-sm text-white transition-colors hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
      {children}
    </p>
  );
}

const GROUP_OPTIONS = [
  { value: "none", label: "None" },
  { value: "date", label: "Date" },
  { value: "workspace", label: "Workspace" },
];

/**
 * "Group by" menu for the recents list (Claude-style). UI only for now — it
 * starts grouping once the recent-sessions list is wired in a later slice.
 */
function GroupByMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Group recents"
          className="grid size-6 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <SlidersHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-normal text-neutral-500">
          Group by
        </DropdownMenuLabel>
        {GROUP_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => onChange(opt.value)}
            className="justify-between"
          >
            {opt.label}
            {value === opt.value && <Check className="size-4 text-neutral-900" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  disabled,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  collapsed: boolean;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  );

  const baseClass = cn(
    "group flex h-9 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors",
    collapsed && "justify-center px-0"
  );
  const stateClass = disabled
    ? "cursor-not-allowed text-neutral-400 opacity-60"
    : active
      ? "bg-neutral-100 text-neutral-950 font-semibold"
      : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950";

  const link = disabled ? (
    <div className={cn(baseClass, stateClass)} aria-disabled="true">
      {inner}
    </div>
  ) : (
    <Link href={href} data-active={active} className={cn(baseClass, stateClass)}>
      {inner}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="bg-neutral-950 text-white">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
