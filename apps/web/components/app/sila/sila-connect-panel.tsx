"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ConnectorResourcePicker, api } from "@/lib/api";
import { connectProvider } from "@/lib/connector-connect";
import { ConnectCancelled } from "@/lib/nango";
import type { SilaConnectRequest } from "@/lib/sila-socket";
import { useToken } from "@/lib/use-token";
import { Link2, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * WS-9 — mid-build connect panel. SILA paused because the agent needs an OAuth
 * app (e.g. Slack) the user hasn't connected. The user authorizes via Nango's
 * Connect UI (no token pasting), picks a destination (e.g. a channel), then the
 * build resumes. A raw token never reaches the browser. Docked above the
 * composer, mirroring the Incognito panel.
 */
type Phase = "intro" | "connecting" | "picking" | "saving";

export function SilaConnectPanel({
  request,
  workspaceId,
  onDone,
}: {
  request: SilaConnectRequest;
  workspaceId: string;
  onDone: (provider: string, ok: boolean) => void;
}) {
  const token = useToken();
  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<ConnectorResourcePicker | null>(null);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [choice, setChoice] = useState<string>("");

  const { provider, label } = request;

  async function connect() {
    setError(null);
    setPhase("connecting");
    try {
      await connectProvider(workspaceId, provider, token);

      // Manifest-driven: ask the catalog which resource pickers this provider has.
      const catalog = await api.connectors.list(workspaceId, token);
      const entry = catalog.find((c) => c.provider === provider);
      const firstPicker = entry?.resource_pickers[0];
      if (!firstPicker) {
        onDone(provider, true); // nothing to pick — resume immediately
        return;
      }
      const opts = await api.connectors.listResources(workspaceId, provider, firstPicker.id, token);
      setPicker(firstPicker);
      setOptions(opts);
      setPhase("picking");
    } catch (err) {
      if (err instanceof ConnectCancelled) {
        setPhase("intro"); // user closed the popup — let them retry or skip
        return;
      }
      setError(err instanceof Error ? err.message : "Connection failed");
      setPhase("intro");
    }
  }

  async function savePick() {
    if (!picker) return;
    const opt = options.find((o) => o.value === choice);
    if (!opt) return;
    setPhase("saving");
    try {
      await api.connectors.saveResources(
        workspaceId,
        provider,
        { [picker.id]: { id: opt.value, label: opt.label } },
        token
      );
      onDone(provider, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      setPhase("picking");
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl">
      <div className="flex items-center gap-2 text-neutral-900">
        <Link2 className="size-4 text-neutral-500" />
        <span className="font-medium text-[15px]">Connect {label}</span>
      </div>
      <p className="mt-1 text-[12px] text-neutral-400">
        You&apos;ll authorize {label} directly — no token to paste. Your credential stays encrypted
        with us; it never appears in this chat.
      </p>

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

      {phase === "picking" && picker && (
        <div className="mt-3">
          <span className="mb-1 block text-[12px] text-neutral-500">{picker.label}</span>
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger>
              <SelectValue placeholder={`Select a ${picker.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onDone(provider, false)}
          className="rounded-lg px-3 py-2 text-neutral-500 text-sm transition-colors hover:text-neutral-800"
        >
          Skip
        </button>
        {phase === "picking" ? (
          <button
            type="button"
            disabled={!choice}
            onClick={savePick}
            className="inline-flex h-9 items-center rounded-lg bg-neutral-950 px-5 font-medium text-sm text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
          >
            Save & continue
          </button>
        ) : (
          <button
            type="button"
            disabled={phase === "connecting" || phase === "saving"}
            onClick={connect}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-neutral-950 px-5 font-medium text-sm text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
          >
            {(phase === "connecting" || phase === "saving") && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Connect {label}
          </button>
        )}
      </div>
    </div>
  );
}
