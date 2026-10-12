export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  verify: "/verify",
  resetPassword: "/reset-password",
  newPassword: "/reset-password/new",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  // "My agents" — the agent-first (Simple shell) list of the current workspace's
  // agents; lives outside /workspaces/* so the SILA sidebar stays mounted.
  myAgents: "/my-agents",
  // Simple-shell Connectors/Knowledge — same bodies as the workspace routes,
  // living outside /workspaces/* so the SILA sidebar stays.
  connectorsHome: "/connectors",
  knowledgeHome: "/knowledge",
  newWorkspace: "/workspaces/new",
  // Members live under the Settings tabs now. The legacy /members route still
  // exists as a redirect for stale links/bookmarks.
  workspaceMembers: (workspaceId: string) => `/workspaces/${workspaceId}/settings/members`,
  agents: (workspaceId: string) => `/workspaces/${workspaceId}/agents`,
  // "New agent" lands on the 3-tab create page (Template / Upload / Build in Dify).
  newAgent: (workspaceId: string) => `/workspaces/${workspaceId}/agents/new`,
  agentsBuild: (workspaceId: string) => `/workspaces/${workspaceId}/agents/build`,
  agentsTemplates: (workspaceId: string) => `/workspaces/${workspaceId}/agents/templates`,
  agentsImport: (workspaceId: string) => `/workspaces/${workspaceId}/agents/import`,
  workflows: (workspaceId: string) => `/workspaces/${workspaceId}/workflows`,
  agentDetail: (workspaceId: string, agentId: string) =>
    `/workspaces/${workspaceId}/agents/${agentId}`,
  agentVetting: (workspaceId: string, agentId: string) =>
    `/workspaces/${workspaceId}/agents/${agentId}/vetting`,
  bazaar: "/bazaar",
  bazaarAgent: (agentId: string) => `/bazaar/${agentId}`,
  hired: "/bazaar/hired",
  workspaceSettings: (workspaceId: string) => `/workspaces/${workspaceId}/settings`,
  workspaceDeveloper: (workspaceId: string) => `/workspaces/${workspaceId}/settings/developer`,
  workspaceDanger: (workspaceId: string) => `/workspaces/${workspaceId}/settings/danger`,
  connectors: (workspaceId: string) => `/workspaces/${workspaceId}/connectors`,
  mcpServers: (workspaceId: string) => `/workspaces/${workspaceId}/connectors/mcp-servers`,
  agentTools: (workspaceId: string, agentId: string) =>
    `/workspaces/${workspaceId}/agents/${agentId}/tools`,
  knowledgeBase: (workspaceId: string) => `/workspaces/${workspaceId}/knowledge-base`,
  kbUpload: (workspaceId: string, kbId: string) =>
    `/workspaces/${workspaceId}/knowledge-base/${kbId}/upload`,
  // Admin panel — its own isolated area (see app/(app)/admin/). All admin-panel
  // work lives under that one folder so it merges cleanly.
  admin: "/admin",
} as const;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:8000";

// Dify web studio — where users build apps before importing them back (Phase 15).
export const DIFY_STUDIO_URL = process.env.NEXT_PUBLIC_DIFY_URL ?? "http://localhost:3000";

export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** The OKR Reporting Pack template: confidential — its sheets upload server-side
 *  and a chat pinned to it carries no skills (the API enforces both). */
export const OKR_TEMPLATE_ID = "tpl-okr-pack";

/** Skills a chat may carry — mirrors the API's SILA_MAX_SKILLS_PER_SESSION. */
export const MAX_CHAT_SKILLS = 3;
