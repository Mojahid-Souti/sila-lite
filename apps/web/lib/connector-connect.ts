import { api } from "@/lib/api";
import { runConnect } from "@/lib/nango";

/**
 * The core Nango connect sequence (session → white-label popup → persist the
 * binding), shared by the SILA mid-build connect panel and the Bazaar hire
 * setup. Throws ConnectCancelled when the user closes the popup.
 */
export async function connectProvider(
  workspaceId: string,
  provider: string,
  token: string
): Promise<string> {
  const session = await api.connectors.createSession(workspaceId, provider, token);
  const connectionId = await runConnect(session.session_token);
  await api.connectors.persistBinding(workspaceId, provider, connectionId, token);
  return connectionId;
}
