"use client";

export const dynamic = "force-dynamic";

import { SilaChat } from "@/components/app/sila/sila-chat";

/**
 * Home — the concierge-first landing (VP direction): non-technical users meet
 * SILA, nothing else. A Claude-style chat thread with a chat/voice toggle; the
 * old KPI dashboard lives on in git history only — it read as stalled on a new
 * workspace, so both it and the per-workspace landing page were removed.
 */
export default function HomePage() {
  return (
    <div className="h-[calc(100vh-3.5rem)] bg-neutral-100">
      <SilaChat />
    </div>
  );
}
