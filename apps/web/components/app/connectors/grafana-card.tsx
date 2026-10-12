"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useToken } from "@/lib/use-token";
import { SiGrafana } from "@icons-pack/react-simple-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Grafana connection — the first self-hosted-URL connector. An admin registers the
 * workspace's Grafana base URL + an API token; the token is verified server-side,
 * encrypted at rest, and never returned. Once connected, SILA can build dashboards
 * on it ("build me a Grafana dashboard with a CPU panel and an errors panel").
 */
export function GrafanaCard({ workspaceId }: { workspaceId: string }) {
  const token = useToken();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [baseUrl, setBaseUrl] = useState("");
  const [apiToken, setApiToken] = useState("");

  const { data: status, isLoading } = useQuery({
    queryKey: ["grafana-status", workspaceId],
    queryFn: () => api.connectors.grafanaStatus(workspaceId, token),
    enabled: !!token,
  });

  const connect = useMutation({
    mutationFn: () => api.connectors.connectGrafana(workspaceId, baseUrl.trim(), apiToken, token),
    onSuccess: () => {
      toast("Grafana connected", "success");
      setApiToken("");
      qc.invalidateQueries({ queryKey: ["grafana-status", workspaceId] });
    },
    onError: (e: Error) => toast(e.message || "Couldn't connect Grafana", "error"),
  });

  const connectBuiltin = useMutation({
    mutationFn: () => api.connectors.connectBuiltinGrafana(workspaceId, token),
    onSuccess: () => {
      toast("Connected to Sila's built-in Grafana", "success");
      qc.invalidateQueries({ queryKey: ["grafana-status", workspaceId] });
    },
    onError: (e: Error) => toast(e.message || "Couldn't connect", "error"),
  });

  const disconnect = useMutation({
    mutationFn: () => api.connectors.disconnectGrafana(workspaceId, token),
    onSuccess: () => {
      toast("Grafana disconnected", "info");
      qc.invalidateQueries({ queryKey: ["grafana-status", workspaceId] });
    },
    onError: (e: Error) => toast(e.message || "Couldn't disconnect", "error"),
  });

  const connected = status?.connected;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg border border-neutral-200 bg-white">
            <SiGrafana color="default" className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-medium text-neutral-900 text-sm">
              Grafana
              {connected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                  <Check className="size-3" /> Connected
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-neutral-500">
              {connected
                ? status?.base_url
                : "Connect Grafana (Cloud or self-hosted) so SILA can build dashboards on it."}
            </p>
          </div>
        </div>
        {connected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
          >
            Disconnect
          </Button>
        )}
      </div>

      {!connected && !isLoading && (
        <button
          type="button"
          onClick={() => connectBuiltin.mutate()}
          disabled={connectBuiltin.isPending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 font-medium text-orange-700 text-sm transition-colors hover:bg-orange-100 disabled:opacity-60"
        >
          {connectBuiltin.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SiGrafana className="size-4" />
          )}
          Use Sila's built-in Grafana (one click)
        </button>
      )}
      {!connected && !isLoading && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (baseUrl.trim() && apiToken.trim()) connect.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="grafana-url">Grafana URL</Label>
            <Input
              id="grafana-url"
              placeholder="https://yourorg.grafana.net"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-[11.5px] text-neutral-400">
              Grafana Cloud: your{" "}
              <span className="font-medium">https://&lt;org&gt;.grafana.net</span> URL. Self-hosted:
              wherever your Grafana runs (e.g. http://localhost:3000).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grafana-token">API token</Label>
            <Input
              id="grafana-token"
              type="password"
              placeholder="glsa_…"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
            <p className="text-[11.5px] text-neutral-400">
              Create one in Grafana → Administration → Service accounts (Editor role). Stored
              encrypted; never shown again.
            </p>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={connect.isPending || !baseUrl.trim() || !apiToken.trim()}
          >
            {connect.isPending && <Loader2 className="size-4 animate-spin" />}
            Connect Grafana
          </Button>
        </form>
      )}
    </div>
  );
}
