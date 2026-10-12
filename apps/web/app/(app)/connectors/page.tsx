"use client";

export const dynamic = "force-dynamic";

import { ConnectorsContent } from "@/components/app/connectors/connectors-content";
import { useWorkspaces } from "@/components/app/workspace-context";

/**
 * Simple-shell Connectors — same body as the workspace route, but it lives at
 * /connectors (outside /workspaces/*) so the SILA sidebar stays (the same
 * pattern as /my-agents). Admin MCP chrome hidden here.
 */
export default function SimpleConnectorsPage() {
  const { currentId: workspaceId } = useWorkspaces();
  if (!workspaceId) return null;
  return <ConnectorsContent workspaceId={workspaceId} showManage={false} />;
}
