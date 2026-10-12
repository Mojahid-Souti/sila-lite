"use client";

export const dynamic = "force-dynamic";

import { useWorkspaces } from "@/components/app/workspace-context";
import { KnowledgeBaseContent } from "@/components/kb/knowledge-base-content";

/**
 * Simple-shell Knowledge — same body as the workspace route, but it lives at
 * /knowledge (outside /workspaces/*) so the SILA sidebar stays (the same
 * pattern as /my-agents and /connectors).
 */
export default function SimpleKnowledgePage() {
  const { currentId: workspaceId } = useWorkspaces();
  if (!workspaceId) return null;
  return <KnowledgeBaseContent workspaceId={workspaceId} />;
}
