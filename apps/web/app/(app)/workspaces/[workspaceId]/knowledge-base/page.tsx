"use client";

export const dynamic = "force-dynamic";

import { KnowledgeBaseContent } from "@/components/kb/knowledge-base-content";
import { use } from "react";

type Props = { params: Promise<{ workspaceId: string }> };

// Operator-shell route — the shared Knowledge body.
export default function KnowledgeBasePage({ params }: Props) {
  const { workspaceId } = use(params);
  return <KnowledgeBaseContent workspaceId={workspaceId} />;
}
