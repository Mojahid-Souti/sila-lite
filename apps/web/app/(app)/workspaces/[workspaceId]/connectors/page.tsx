"use client";

import { ConnectorsContent } from "@/components/app/connectors/connectors-content";
import { useParams } from "next/navigation";

// Operator-shell route — the shared body with the admin MCP chrome.
export default function ToolsCatalogPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return <ConnectorsContent workspaceId={workspaceId} showManage />;
}
