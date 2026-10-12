import { redirect } from "next/navigation";

/**
 * The per-workspace landing page is gone: on a fresh workspace it rendered
 * empty stat cards and read as a stalled dashboard. Nothing links here any
 * more, but bookmarks and back-button history still do — so this segment
 * forwards to Agents instead of dead-ending on a 404.
 */
export default async function WorkspaceIndexPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  redirect(`/workspaces/${workspaceId}/agents`);
}
