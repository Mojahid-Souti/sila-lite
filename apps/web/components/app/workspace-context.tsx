"use client";

import { api } from "@/lib/api";
import { useToken } from "@/lib/use-token";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Workspace = { id: string; name: string; slug: string };

type WorkspaceContextValue = {
  workspaces: Workspace[];
  currentId: string | null;
  current: Workspace | null;
  loading: boolean;
  /** Persist the user's workspace choice (the switcher calls this). */
  selectWorkspace: (id: string) => void;
};

// The user's last-chosen workspace, so an invitee who lands via a ?ws= link (or
// picks a shared workspace in the switcher) doesn't snap back to their own
// auto-created personal one — workspaces sort newest-first, so the personal
// workspace would otherwise always win.
const LAST_WS_KEY = "sila:last-ws";

function readStoredWs(): string | null {
  try {
    return localStorage.getItem(LAST_WS_KEY);
  } catch {
    return null;
  }
}

function storeWs(id: string): void {
  try {
    localStorage.setItem(LAST_WS_KEY, id);
  } catch {
    /* storage unavailable — selection just won't persist */
  }
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  currentId: null,
  current: null,
  loading: true,
  selectWorkspace: () => {},
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const token = useToken();
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosenId, setChosenId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    api.workspaces
      .list(token)
      .then((data) => {
        if (!cancelled) setWorkspaces(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectWorkspace = useCallback((id: string) => {
    storeWs(id);
    setChosenId(id);
  }, []);

  // An invite email's deep link (/dashboard?ws=<id>) selects that workspace on
  // arrival — the lazy-user path: click the link, land in the team's workspace.
  // window.location (not useSearchParams) so the provider needs no Suspense.
  useEffect(() => {
    const ws = new URLSearchParams(window.location.search).get("ws");
    if (ws) selectWorkspace(ws);
  }, [selectWorkspace]);

  const currentId = useMemo(() => {
    // Precedence: explicit URL (/workspaces/{id}/…) → this-session choice →
    // the stored last choice → the newest workspace. Every candidate must be
    // one the user is actually a member of (fail-safe against stale storage).
    const member = (id: string | null | undefined): string | null =>
      id && workspaces.some((w) => w.id === id) ? id : null;
    const m = pathname.match(/^\/workspaces\/([^/]+)/);
    if (m?.[1]) return m[1];
    return member(chosenId) ?? member(readStoredWs()) ?? workspaces[0]?.id ?? null;
  }, [pathname, workspaces, chosenId]);

  const current = useMemo(
    () => workspaces.find((w) => w.id === currentId) ?? null,
    [workspaces, currentId]
  );

  const value = useMemo(
    () => ({ workspaces, currentId, current, loading, selectWorkspace }),
    [workspaces, currentId, current, loading, selectWorkspace]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaces(): WorkspaceContextValue {
  return useContext(WorkspaceContext);
}
