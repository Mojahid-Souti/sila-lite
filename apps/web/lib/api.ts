import { refreshTokens } from "./auth-refresh";
import { clearTokens } from "./auth-storage";
import { API_URL, ROUTES } from "./constants";
import type { SilaSegment } from "./sila-socket";

function handleExpiredSession(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/login")) return;
  clearTokens();
  window.location.href = `${ROUTES.login}?expired=1`;
}

function formatErrorDetail(detail: unknown, status: number): string {
  // FastAPI returns either a string (HTTPException) or an array of
  // Pydantic-validation objects (RequestValidationError). Format the array
  // into a human-readable single line so toasts/banners don't show
  // "[object Object]".
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object" && "msg" in d) {
          const loc = Array.isArray((d as { loc?: unknown[] }).loc)
            ? (d as { loc: unknown[] }).loc.join(".")
            : "";
          return loc ? `${loc}: ${(d as { msg: string }).msg}` : (d as { msg: string }).msg;
        }
        return JSON.stringify(d);
      })
      .join("; ");
  }
  // YAML import returns detail = { errors: [...] }; surface them as one line.
  if (
    detail &&
    typeof detail === "object" &&
    Array.isArray((detail as { errors?: unknown[] }).errors)
  ) {
    return (detail as { errors: unknown[] }).errors.map(String).join("; ");
  }
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return `HTTP ${status}`;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  retried = false
): Promise<T> {
  // FormData (file uploads) needs the browser to set the multipart boundary;
  // forcing JSON Content-Type would corrupt the upload and cause a 422.
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    // Token rejected → try one silent refresh + retry before logging out. Only
    // a genuinely expired/revoked session (refresh also fails) redirects.
    if (!retried) {
      const fresh = await refreshTokens();
      if (fresh) return request<T>(path, options, fresh, true);
    }
    handleExpiredSession();
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatErrorDetail(body.detail, res.status));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type MemberOut = {
  user_id: string;
  role: string;
  invited_by: string | null;
  // Identity resolved server-side via the AuthService adapter on list; absent
  // (null) when the auth provider can't resolve the id.
  email?: string | null;
  full_name?: string | null;
};

export type PublisherDestination =
  | { type: "slack"; channel_id?: string; channel_name?: string }
  | { type: "email"; to: string }
  | { type: "gmail"; to: string }
  | { type: "google-sheets"; spreadsheet_id: string }
  | { type: "google-chat"; space?: string }
  | { type: "google-tasks" }
  | { type: "google-docs"; title?: string }
  | { type: "google-calendar"; calendar_id?: string }
  | { type: "outlook-mail"; to: string }
  | { type: "outlook-calendar" }
  | { type: "ms-teams"; teams_target?: string }
  | { type: "ms-todo" }
  | { type: "ms-onenote" }
  | { type: "ms-onedrive" }
  | { type: "ms-excel"; excel_link?: string }
  | { type: "ms-word" }
  | { type: "ms-powerpoint" };

export type PublisherConfig = {
  schedule?: { cron: string; timezone?: string } | null;
  destinations?: PublisherDestination[];
  kb_id?: string | null;
  docs?: string[];
  content?: string | null;
  model?: string;
  language?: string; // output language ("en"/"ar"), detected from the build conversation
  active?: boolean; // whether the n8n workflow is turned on (running on its schedule)
};

export type AgentOut = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  owner_id: string;
  tags: string[];
  status: string;
  status_label: string;
  language: string;
  classification: string;
  kind: string;
  publisher_config: PublisherConfig | null;
  created_at: string;
  updated_at: string;
  // Expert-only — null for a Beginner (dropped server-side, not CSS).
  version: number | null;
  vetting_status: string | null;
  dify_app_id: string | null;
};

export type WorkflowSource = {
  id: string;
  name: string;
  active: boolean;
  updated_at: string | null;
};

// WS-9 — connector authorization (Nango).
export type ConnectorResourcePicker = { id: string; label: string };

export type ConnectorOut = {
  provider: string;
  label: string;
  auth_type: string;
  scopes: string[];
  connected: boolean;
  selected_resources: Record<string, { id?: string; label?: string } | unknown>;
  resource_pickers: ConnectorResourcePicker[];
};

export type ConnectSessionOut = {
  provider: string;
  integration_id: string;
  session_token: string;
};

export type ResourceOptionOut = {
  value: string;
  label: string;
};

export type DifyAppOut = {
  id: string;
  name: string;
  mode: string;
  description: string;
};

export type AgentVersionOut = {
  id: string;
  agent_id: string;
  version_num: number;
  name: string;
  description: string;
  changed_by: string;
  change_note: string;
  created_at: string;
};

export type TemplateOut = {
  id: string;
  name: string;
  description: string;
  icon_emoji?: string;
  icon_background?: string;
  icon_name?: string;
  category?: string;
  classification?: "Public" | "Internal" | "Restricted" | "Confidential" | string;
  connectors?: string[];
  tags?: string[];
  use_count?: number;
  featured?: boolean;
  sample_prompts?: string[];
};

export type BazaarAgentOut = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  status: string;
  language: string;
  classification: string;
  kind?: string;
  liked_count?: number;
  disliked_count?: number;
  my_reaction?: "like" | "dislike" | null;
  owner_id: string;
  workspace_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  hired: boolean;
  rating?: { avg: number | null; count: number };
  category_ids?: string[];
  // Bazaar provenance (Slice: org layer) — which of the 4 sections this belongs
  // to, plus the creator + owning-org labels.
  provenance?: "mine" | "shared" | "org" | "third_party";
  creator?: string;
  org_name?: string | null;
  organization_id?: string | null;
  // Detail-only enrichment (the agent card): granted tools + all-time tokens.
  permissions?: string[];
  token_usage?: number;
  // Sanitized "what you'll need" for workflow agents — provider TYPES only,
  // never the publisher's targets/docs (server-side whitelist).
  requirements?: {
    data_mode: "included" | "own_docs";
    requires: string[];
    needs_email_recipient: boolean;
    schedule: { cron: string; timezone: string | null } | null;
    content: string | null;
    docs_count: number;
    language: string | null;
  } | null;
};

export type BazaarRequirements = NonNullable<BazaarAgentOut["requirements"]>;

/** The user's cross-chat SILA memory: entries + the cap + the full flag. */
export type SilaMemoryOut = {
  items: { id: string; content: string; created_at: string }[];
  limit: number;
  full: boolean;
};

/** An uploaded analysis dataset — the bytes live on the server (DuckDB reads the
 *  FULL file); the chat carries only this handle. */
export type SilaDatasetOut = {
  id: string;
  filename: string;
  size_bytes: number;
  rows: number | null;
};

/** A built-in ready-to-use template (virtual Bazaar listing — code registry). */
export type BuiltinTemplateOut = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category_slug: string;
  kind: "chat";
  is_template: true;
  classification: string;
  chip_hint: string;
  sources: string[];
  outputs: string[];
  /** Who authored it — the Bazaar groups templates under this. */
  publisher: string;
};

/** An open-source Agent Skill in the Bazaar (Phase 18). Only its instructions are
 *  kept; scripts are never run. `category` is a key (see skills.categories.*). */
export type SkillOut = {
  id: string;
  workspace_id: string;
  source: string;
  skill_key: string;
  name: string;
  description: string;
  category: string;
  repo_url: string;
  license: string | null;
  installs: number;
  has_scripts: boolean;
  dependencies: { type: string; name: string }[];
  vetting_status: "needs_review" | "approved" | "rejected";
  findings: { type: string; severity: string; preview: string }[];
  published: boolean;
  imported_at: string | null;
  /** Present on the detail endpoint only. */
  instructions?: string;
};

export type SkillListOut = {
  items: SkillOut[];
  total: number;
  page: number;
  size: number;
  /** Published skills per category key, for the filter chips. */
  categories: Record<string, number>;
};

/** A skill as the upstream catalog lists it (for an Admin to import). */
export type CatalogSkillOut = {
  source: string;
  skill_key: string;
  name: string;
  description: string;
  repo_url: string;
  installs: number;
  license: string | null;
  has_scripts: boolean;
  imported: boolean;
  imported_status: SkillOut["vetting_status"] | null;
  imported_id: string | null;
};

export type SkillFilters = {
  q?: string;
  category?: string | null;
  instructionsOnly?: boolean;
  licensedOnly?: boolean;
  sort?: "popular" | "newest";
  page?: number;
  size?: number;
};

export type NotificationOut = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export type CategoryOut = {
  id: string;
  name: string;
  slug: string;
};

export type ReviewOut = {
  id: string;
  author_id: string;
  rating: number;
  body: string;
  created_at: string;
};

export type HireOut = {
  id: string;
  workspace_id: string;
  agent_id: string;
  hired_at: string;
};

export const api = {
  auth: {
    signup: (email: string, password: string, fullName?: string) =>
      request("/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name: fullName }),
      }),
    login: (email: string, password: string) =>
      request<{ access_token: string; refresh_token: string; user: { id: string; email: string } }>(
        "/v1/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      ),
    resetPassword: (email: string) =>
      request("/v1/auth/reset-password", { method: "POST", body: JSON.stringify({ email }) }),
    me: (token: string) => request("/v1/auth/me", {}, token),
    refresh: (refreshToken: string) =>
      request<{ access_token: string; refresh_token: string; user: { id: string; email: string } }>(
        "/v1/auth/refresh",
        { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }
      ),
    // Phase 17 — persist onboarding answers; server computes ux_mode + sets the
    // onboarding_complete flag on the user. Refresh the session afterwards to
    // pick up the new JWT claims.
    completeOnboarding: (
      body: {
        referral_source: string;
        referral_source_other?: string;
        job_role: string;
        job_role_other?: string;
        agent_experience: string;
      },
      token: string
    ) =>
      request<{ id: string; email: string; onboarding_complete: boolean; ux_mode: string | null }>(
        "/v1/auth/onboarding",
        { method: "PATCH", body: JSON.stringify(body) },
        token
      ),
    // A user renaming THEMSELVES. Writes their own user_metadata through their
    // own token, so it needs no extra authorization check.
    updateProfile: (fullName: string, token: string) =>
      request<{ id: string; email: string; full_name: string | null }>(
        "/v1/auth/profile",
        { method: "PATCH", body: JSON.stringify({ full_name: fullName }) },
        token
      ),
  },
  sila: {
    // Locally-installed models for the SILA model picker.
    listModels: (token: string) =>
      request<{ models: string[]; default: string; recommended?: string[] }>(
        "/v1/sila/models",
        {},
        token
      ),
    // Recent SILA sessions for the sidebar history.
    listSessions: (token: string) =>
      request<{ sessions: { id: string; title: string; started_at: string }[] }>(
        "/v1/sila/sessions",
        {},
        token
      ),
    // A session's transcript so the chat can resume it.
    getSession: (id: string, token: string) =>
      request<{
        messages: {
          role: string;
          content: string;
          trace?: SilaSegment[] | null;
          created_at?: string | null;
        }[];
      }>(`/v1/sila/sessions/${id}`, {}, token),
    deleteSession: (id: string, token: string) =>
      request<void>(`/v1/sila/sessions/${id}`, { method: "DELETE" }, token),
    // Bulk delete — one call for a multi-select, not one DELETE per row.
    // `removed` may be lower than the ids sent (already gone / not the user's).
    deleteSessions: (ids: string[], token: string) =>
      request<{ removed: number }>(
        "/v1/sila/sessions/bulk-delete",
        { method: "POST", body: JSON.stringify({ session_ids: ids }) },
        token
      ),
    // Per-user memory — durable facts SILA keeps across chats (capacity-capped).
    memory: (token: string) => request<SilaMemoryOut>("/v1/sila/memory", {}, token),
    deleteMemory: (id: string, token: string) =>
      request<void>(`/v1/sila/memory/${id}`, { method: "DELETE" }, token),
    clearMemory: (token: string) => request<void>("/v1/sila/memory", { method: "DELETE" }, token),
    // Big data files upload as DATASETS (bytes on disk; analysis is full-file).
    uploadDataset: (workspaceId: string, file: File, token: string) => {
      const form = new FormData();
      form.append("file", file);
      return request<SilaDatasetOut>(
        `/v1/sila/datasets?workspace_id=${workspaceId}`,
        { method: "POST", body: form, headers: {} },
        token
      );
    },
  },
  workspaces: {
    create: (name: string, description: string, token: string) =>
      request<{ id: string; name: string; slug: string; description: string; owner_id: string }>(
        "/v1/workspaces",
        { method: "POST", body: JSON.stringify({ name, description }) },
        token
      ),
    list: (token: string) =>
      request<{ id: string; name: string; slug: string; description: string }[]>(
        "/v1/workspaces",
        {},
        token
      ),
    get: (workspaceId: string, token: string) =>
      request<{ id: string; name: string; slug: string; description: string; owner_id: string }>(
        `/v1/workspaces/${workspaceId}`,
        {},
        token
      ),
    update: (workspaceId: string, name: string, description: string, token: string) =>
      request<{ id: string; name: string; slug: string; description: string; owner_id: string }>(
        `/v1/workspaces/${workspaceId}`,
        { method: "PUT", body: JSON.stringify({ name, description }) },
        token
      ),
    delete: (workspaceId: string, token: string) =>
      request<void>(`/v1/workspaces/${workspaceId}`, { method: "DELETE" }, token),
    members: {
      list: (workspaceId: string, token: string) =>
        request<MemberOut[]>(`/v1/workspaces/${workspaceId}/members`, {}, token),
      invite: (workspaceId: string, userId: string, role: string, token: string) =>
        request<MemberOut>(
          `/v1/workspaces/${workspaceId}/members`,
          { method: "POST", body: JSON.stringify({ user_id: userId, role }) },
          token
        ),
      remove: (workspaceId: string, userId: string, token: string) =>
        request<void>(
          `/v1/workspaces/${workspaceId}/members/${userId}`,
          { method: "DELETE" },
          token
        ),
    },
  },
  users: {
    lookup: (email: string, token: string) =>
      request<{ id: string; email: string }>(
        `/v1/users/lookup?email=${encodeURIComponent(email)}`,
        {},
        token
      ),
  },
  agents: {
    list: (workspaceId: string, token: string, statusFilter?: string) => {
      const qs = statusFilter ? `?status_filter=${statusFilter}` : "";
      return request<{ items: AgentOut[]; total: number; page: number; size: number }>(
        `/v1/workspaces/${workspaceId}/agents${qs}`,
        {},
        token
      );
    },
    get: (workspaceId: string, agentId: string, token: string) =>
      request<AgentOut>(`/v1/workspaces/${workspaceId}/agents/${agentId}`, {}, token),
    updateConfig: (
      workspaceId: string,
      agentId: string,
      body: {
        name?: string;
        schedule?: { cron: string; timezone: string };
        destinations?: PublisherDestination[];
        docs?: string[];
      },
      token: string
    ) =>
      request<{ agent: AgentOut; revet: boolean }>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/config`,
        { method: "PATCH", body: JSON.stringify(body) },
        token
      ),
    setActivation: (workspaceId: string, agentId: string, active: boolean, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/activation`,
        { method: "POST", body: JSON.stringify({ active }) },
        token
      ),
    importYaml: (workspaceId: string, file: File, token: string) => {
      const form = new FormData();
      form.append("file", file);
      return request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agent-imports`,
        { method: "POST", body: form, headers: {} },
        token
      );
    },
    importTemplate: (workspaceId: string, templateId: string, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agent-imports/template`,
        { method: "POST", body: JSON.stringify({ template_id: templateId }) },
        token
      ),
    difyApps: (workspaceId: string, token: string) =>
      request<DifyAppOut[]>(`/v1/workspaces/${workspaceId}/dify-apps`, {}, token),
    importFromDify: (workspaceId: string, difyAppId: string, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/import-from-dify`,
        { method: "POST", body: JSON.stringify({ dify_app_id: difyAppId }) },
        token
      ),
    workflowSources: (workspaceId: string, token: string) =>
      request<WorkflowSource[]>(`/v1/workspaces/${workspaceId}/agents/workflow-sources`, {}, token),
    registerWorkflow: (workspaceId: string, workflowId: string, token: string) =>
      request<{ agent: AgentOut; vetting_run_id: string }>(
        `/v1/workspaces/${workspaceId}/agents/register-workflow`,
        { method: "POST", body: JSON.stringify({ workflow_id: workflowId }) },
        token
      ),
    publish: (workspaceId: string, agentId: string, token: string, includeDocs = false) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/publish`,
        { method: "POST", body: JSON.stringify({ include_docs: includeDocs }) },
        token
      ),
    archive: (workspaceId: string, agentId: string, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/archive`,
        { method: "POST" },
        token
      ),
    clone: (workspaceId: string, agentId: string, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/clone`,
        { method: "POST" },
        token
      ),
    versions: (workspaceId: string, agentId: string, token: string) =>
      request<AgentVersionOut[]>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/versions`,
        {},
        token
      ),
    yaml: (workspaceId: string, agentId: string, token: string) =>
      request<{ yaml: string; version: number }>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/yaml`,
        {},
        token
      ),
    rollback: (workspaceId: string, agentId: string, versionNum: number, token: string) =>
      request<AgentOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/versions/${versionNum}/rollback`,
        { method: "POST" },
        token
      ),
    test: (workspaceId: string, agentId: string, query: string, token: string) =>
      request<{ answer: string; usage: Record<string, unknown> }>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/test`,
        { method: "POST", body: JSON.stringify({ query }) },
        token
      ),
  },
  templates: {
    list: (token: string) => request<TemplateOut[]>("/v1/templates", {}, token),
  },
  bazaar: {
    list: (
      workspaceId: string,
      token: string,
      opts: { q?: string; cat?: string[]; page?: number; size?: number } = {}
    ) => {
      const params = new URLSearchParams({ workspace_id: workspaceId });
      if (opts.q) params.set("q", opts.q);
      if (opts.cat?.length) for (const c of opts.cat) params.append("cat", c);
      if (opts.page) params.set("page", String(opts.page));
      if (opts.size) params.set("size", String(opts.size));
      return request<{ items: BazaarAgentOut[]; total: number; page: number; size: number }>(
        `/v1/bazaar/agents?${params}`,
        {},
        token
      );
    },
    get: (agentId: string, workspaceId: string, token: string) =>
      request<BazaarAgentOut>(
        `/v1/bazaar/agents/${agentId}?workspace_id=${workspaceId}`,
        {},
        token
      ),
    categories: (token: string) => request<CategoryOut[]>("/v1/bazaar/categories", {}, token),
    templates: (token: string) => request<BuiltinTemplateOut[]>("/v1/bazaar/templates", {}, token),
    reviews: (agentId: string, token: string, page = 1) =>
      request<{ items: ReviewOut[]; total: number; page: number; size: number }>(
        `/v1/bazaar/agents/${agentId}/reviews?page=${page}`,
        {},
        token
      ),
    submitReview: (
      agentId: string,
      workspaceId: string,
      rating: number,
      body: string,
      token: string
    ) =>
      request<ReviewOut>(
        `/v1/bazaar/agents/${agentId}/reviews?workspace_id=${workspaceId}`,
        { method: "POST", body: JSON.stringify({ rating, body }) },
        token
      ),
    trending: (workspaceId: string, token: string) =>
      request<BazaarAgentOut | null>(`/v1/bazaar/trending?workspace_id=${workspaceId}`, {}, token),
    react: (
      agentId: string,
      workspaceId: string,
      reaction: "like" | "dislike" | null,
      token: string
    ) =>
      request<{ liked_count: number; disliked_count: number; my_reaction: string | null }>(
        `/v1/bazaar/agents/${agentId}/reactions?workspace_id=${workspaceId}`,
        { method: "POST", body: JSON.stringify({ reaction }) },
        token
      ),
    report: (agentId: string, workspaceId: string, reason: string, token: string) =>
      request<{ id: string; status: string; created_at: string }>(
        `/v1/bazaar/agents/${agentId}/reports?workspace_id=${workspaceId}`,
        { method: "POST", body: JSON.stringify({ reason }) },
        token
      ),
  },
  skills: {
    list: (token: string, f: SkillFilters = {}) => {
      const params = new URLSearchParams();
      if (f.q) params.set("q", f.q);
      if (f.category) params.set("category", f.category);
      if (f.instructionsOnly) params.set("instructions_only", "true");
      if (f.licensedOnly) params.set("licensed_only", "true");
      if (f.sort) params.set("sort", f.sort);
      params.set("page", String(f.page ?? 1));
      params.set("size", String(f.size ?? 20));
      return request<SkillListOut>(`/v1/bazaar/skills?${params}`, {}, token);
    },
    get: (skillId: string, token: string, workspaceId?: string) =>
      request<SkillOut>(
        `/v1/bazaar/skills/${skillId}${workspaceId ? `?workspace_id=${workspaceId}` : ""}`,
        {},
        token
      ),
    catalog: (workspaceId: string, token: string, q = "", page = 1) =>
      request<{ items: CatalogSkillOut[]; total: number; page: number; size: number }>(
        `/v1/workspaces/${workspaceId}/skills/catalog?${new URLSearchParams({
          q,
          page: String(page),
          size: "20",
        })}`,
        {},
        token
      ),
    importSkill: (workspaceId: string, source: string, skillKey: string, token: string) =>
      request<SkillOut>(
        `/v1/workspaces/${workspaceId}/skills/import`,
        { method: "POST", body: JSON.stringify({ source, skill_key: skillKey }) },
        token
      ),
    mine: (workspaceId: string, token: string, size = 100) =>
      request<{ items: SkillOut[] }>(
        `/v1/workspaces/${workspaceId}/skills?size=${size}`,
        {},
        token
      ),
    decide: (
      workspaceId: string,
      skillId: string,
      decision: "approve" | "reject" | "rescan" | "publish" | "unpublish",
      token: string
    ) =>
      request<SkillOut>(
        `/v1/workspaces/${workspaceId}/skills/${skillId}/${decision}`,
        { method: "POST" },
        token
      ),
    remove: (workspaceId: string, skillId: string, token: string) =>
      request<void>(`/v1/workspaces/${workspaceId}/skills/${skillId}`, { method: "DELETE" }, token),
  },
  notifications: {
    list: (token: string) =>
      request<{ items: NotificationOut[]; unread: number }>("/v1/notifications", {}, token),
    read: (id: string, token: string) =>
      request<void>(`/v1/notifications/${id}/read`, { method: "POST" }, token),
    readAll: (token: string) =>
      request<{ marked: number }>("/v1/notifications/read-all", { method: "POST" }, token),
  },
  hires: {
    list: (workspaceId: string, token: string, page = 1) =>
      request<{ items: BazaarAgentOut[]; total: number; page: number; size: number }>(
        `/v1/workspaces/${workspaceId}/hires?page=${page}`,
        {},
        token
      ),
    hire: (workspaceId: string, agentId: string, token: string) =>
      request<HireOut>(
        `/v1/workspaces/${workspaceId}/hires?agent_id=${agentId}`,
        { method: "POST" },
        token
      ),
    unhire: (workspaceId: string, agentId: string, token: string) =>
      request<void>(`/v1/workspaces/${workspaceId}/hires/${agentId}`, { method: "DELETE" }, token),
    // Hire-with-your-own-accounts: provision the caller's OWN runnable copy of
    // a published workflow agent (their destinations/docs/bindings).
    provision: (
      workspaceId: string,
      agentId: string,
      body: {
        destinations: Array<Record<string, string>>;
        schedule?: { cron: string; timezone: string };
        kb_id?: string;
        name?: string;
      },
      token: string
    ) =>
      request<{ agent: AgentOut; vetting_run_id: string; hire_id: string; warnings: string[] }>(
        `/v1/workspaces/${workspaceId}/hires/${agentId}/provision`,
        { method: "POST", body: JSON.stringify(body) },
        token
      ),
  },
  kb: {
    listKBs: (workspaceId: string, token: string, page = 1) =>
      request<{ items: KBOut[]; total: number; page: number; size: number }>(
        `/v1/workspaces/${workspaceId}/kbs?page=${page}`,
        {},
        token
      ),
    createKB: (
      workspaceId: string,
      body: { name: string; description?: string; scope?: string; agent_id?: string | null },
      token: string
    ) =>
      request<KBOut>(
        `/v1/workspaces/${workspaceId}/kbs`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        token
      ),
    getKB: (workspaceId: string, kbId: string, token: string) =>
      request<KBOut>(`/v1/workspaces/${workspaceId}/kbs/${kbId}`, {}, token),
    deleteKB: (workspaceId: string, kbId: string, token: string) =>
      request<void>(`/v1/workspaces/${workspaceId}/kbs/${kbId}`, { method: "DELETE" }, token),
    listDocuments: (workspaceId: string, kbId: string, token: string, page = 1) =>
      request<{ items: KBDocumentOut[]; total: number; page: number; size: number }>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/documents?page=${page}`,
        {},
        token
      ),
    getDocument: (workspaceId: string, kbId: string, docId: string, token: string) =>
      request<KBDocumentOut>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/documents/${docId}`,
        {},
        token
      ),
    uploadDocument: (workspaceId: string, kbId: string, file: File, token: string) => {
      const form = new FormData();
      form.append("file", file);
      return request<KBUploadAcceptedOut>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/documents`,
        { method: "POST", body: form, headers: {} },
        token
      );
    },
    deleteDocument: (workspaceId: string, kbId: string, docId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/documents/${docId}`,
        { method: "DELETE" },
        token
      ),
    search: (workspaceId: string, kbId: string, query: string, topK: number, token: string) =>
      request<KBSearchOut>(
        `/v1/workspaces/${workspaceId}/kbs/${kbId}/search`,
        { method: "POST", body: JSON.stringify({ query, top_k: topK }) },
        token
      ),
  },
  mcpServers: {
    list: (workspaceId: string, token: string) =>
      request<MCPServerOut[]>(`/v1/workspaces/${workspaceId}/mcp-servers`, {}, token),
    register: (
      workspaceId: string,
      body: {
        name: string;
        description?: string;
        url: string;
        auth_token?: string;
        auth_header?: string;
        auth_scheme?: string;
      },
      token: string
    ) =>
      request<MCPServerOut>(
        `/v1/workspaces/${workspaceId}/mcp-servers`,
        { method: "POST", body: JSON.stringify(body) },
        token
      ),
    delete: (workspaceId: string, serverId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/mcp-servers/${serverId}`,
        { method: "DELETE" },
        token
      ),
    discover: (workspaceId: string, serverId: string, token: string) =>
      request<ToolOut[]>(
        `/v1/workspaces/${workspaceId}/mcp-servers/${serverId}/discover`,
        { method: "POST" },
        token
      ),
  },
  tools: {
    listWorkspaceTools: (workspaceId: string, token: string) =>
      request<ToolOut[]>(`/v1/workspaces/${workspaceId}/tools`, {}, token),
    listAgentTools: (workspaceId: string, agentId: string, token: string) =>
      request<ToolOut[]>(`/v1/workspaces/${workspaceId}/agents/${agentId}/tools`, {}, token),
    grant: (workspaceId: string, agentId: string, toolId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/tools`,
        { method: "POST", body: JSON.stringify({ tool_id: toolId }) },
        token
      ),
    revoke: (workspaceId: string, agentId: string, toolId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/tools/${toolId}`,
        { method: "DELETE" },
        token
      ),
    invoke: (
      workspaceId: string,
      agentId: string,
      toolId: string,
      args: Record<string, unknown>,
      token: string
    ) =>
      request<ToolInvocationOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/tools/${toolId}/invoke`,
        { method: "POST", body: JSON.stringify({ arguments: args }) },
        token
      ),
    recentInvocations: (workspaceId: string, token: string, limit = 50) =>
      request<ToolInvocationOut[]>(
        `/v1/workspaces/${workspaceId}/tool-invocations?limit=${limit}`,
        {},
        token
      ),
  },
  // WS-9 — connector authorization (Nango). The browser only ever sees a
  // short-lived session token + connection refs — never a raw provider token.
  connectors: {
    list: (workspaceId: string, token: string) =>
      request<ConnectorOut[]>(`/v1/workspaces/${workspaceId}/connectors`, {}, token),
    createSession: (workspaceId: string, provider: string, token: string) =>
      request<ConnectSessionOut>(
        `/v1/workspaces/${workspaceId}/connectors/${provider}/session`,
        { method: "POST" },
        token
      ),
    persistBinding: (workspaceId: string, provider: string, connectionId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/connectors/${provider}/binding`,
        { method: "POST", body: JSON.stringify({ connection_id: connectionId }) },
        token
      ),
    listResources: (workspaceId: string, provider: string, picker: string, token: string) =>
      request<ResourceOptionOut[]>(
        `/v1/workspaces/${workspaceId}/connectors/${provider}/resources/${picker}`,
        {},
        token
      ),
    saveResources: (
      workspaceId: string,
      provider: string,
      resources: Record<string, unknown>,
      token: string
    ) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/connectors/${provider}/resources`,
        { method: "PUT", body: JSON.stringify({ resources }) },
        token
      ),
    revoke: (workspaceId: string, provider: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/connectors/${provider}`,
        { method: "DELETE" },
        token
      ),
    grafanaStatus: (workspaceId: string, token: string) =>
      request<{ connected: boolean; base_url: string | null }>(
        `/v1/workspaces/${workspaceId}/connectors/grafana/status`,
        {},
        token
      ),
    connectGrafana: (workspaceId: string, baseUrl: string, apiToken: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/connectors/grafana`,
        { method: "PUT", body: JSON.stringify({ base_url: baseUrl, token: apiToken }) },
        token
      ),
    connectBuiltinGrafana: (workspaceId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/connectors/grafana/builtin`,
        { method: "POST" },
        token
      ),
    listPptxTemplates: (workspaceId: string, token: string) =>
      request<
        {
          id: string;
          name: string;
          file_size: number;
          created_at: string;
          thumbnails?: string[];
          builtin?: boolean;
        }[]
      >(`/v1/workspaces/${workspaceId}/templates/pptx`, {}, token),
    uploadPptxTemplate: (workspaceId: string, name: string, file: File, token: string) => {
      const form = new FormData();
      form.append("file", file);
      form.append("name", name);
      return request<{ id: string; name: string }>(
        `/v1/workspaces/${workspaceId}/templates/pptx`,
        { method: "POST", body: form },
        token
      );
    },
    deletePptxTemplate: (workspaceId: string, templateId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/templates/pptx/${templateId}`,
        { method: "DELETE" },
        token
      ),
    disconnectGrafana: (workspaceId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/connectors/grafana`,
        { method: "DELETE" },
        token
      ),
  },
  vetting: {
    submit: (workspaceId: string, agentId: string, token: string) =>
      request<VettingRunOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/submit-for-review`,
        { method: "POST" },
        token
      ),
    listRuns: (workspaceId: string, agentId: string, token: string) =>
      request<VettingRunOut[]>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs`,
        {},
        token
      ),
    getRun: (workspaceId: string, agentId: string, runId: string, token: string) =>
      request<VettingRunOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs/${runId}`,
        {},
        token
      ),
    listFindings: (workspaceId: string, agentId: string, runId: string, token: string) =>
      request<VettingFindingOut[]>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs/${runId}/findings`,
        {},
        token
      ),
    approve: (workspaceId: string, agentId: string, runId: string, note: string, token: string) =>
      request<VettingRunOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs/${runId}/approve`,
        { method: "POST", body: JSON.stringify({ note }) },
        token
      ),
    reject: (workspaceId: string, agentId: string, runId: string, note: string, token: string) =>
      request<VettingRunOut>(
        `/v1/workspaces/${workspaceId}/agents/${agentId}/vetting-runs/${runId}/reject`,
        { method: "POST", body: JSON.stringify({ note }) },
        token
      ),
  },
  apiKeys: {
    list: (workspaceId: string, token: string) =>
      request<ApiKeyOut[]>(`/v1/workspaces/${workspaceId}/api-keys`, {}, token),
    create: (workspaceId: string, name: string, token: string) =>
      request<ApiKeyCreatedOut>(
        `/v1/workspaces/${workspaceId}/api-keys`,
        { method: "POST", body: JSON.stringify({ name }) },
        token
      ),
    revoke: (workspaceId: string, keyId: string, token: string) =>
      request<void>(`/v1/workspaces/${workspaceId}/api-keys/${keyId}`, { method: "DELETE" }, token),
  },
  analytics: {
    kpis: (workspaceId: string, rangeDays: number, token: string) =>
      request<KpiOut>(
        `/v1/workspaces/${workspaceId}/analytics/kpis?range_days=${rangeDays}`,
        {},
        token
      ),
    computeCost: (workspaceId: string, rangeDays: number, token: string) =>
      request<ComputeCostOut>(
        `/v1/workspaces/${workspaceId}/analytics/compute-cost?range_days=${rangeDays}`,
        {},
        token
      ),
    timeseries: (workspaceId: string, rangeDays: number, token: string) =>
      request<TimeseriesPointOut[]>(
        `/v1/workspaces/${workspaceId}/analytics/timeseries?range_days=${rangeDays}`,
        {},
        token
      ),
    topAgents: (workspaceId: string, rangeDays: number, n: number, token: string) =>
      request<AgentLeaderboardRowOut[]>(
        `/v1/workspaces/${workspaceId}/analytics/top-agents?range_days=${rangeDays}&n=${n}`,
        {},
        token
      ),
    evaluateAnomalies: (workspaceId: string, token: string) =>
      request<AnomalyEvalOut[]>(`/v1/workspaces/${workspaceId}/anomalies/evaluate`, {}, token),
    listAnomalies: (workspaceId: string, token: string) =>
      request<AnomalyOut[]>(`/v1/workspaces/${workspaceId}/anomalies`, {}, token),
    acknowledgeAnomaly: (workspaceId: string, alertId: string, token: string) =>
      request<AnomalyOut>(
        `/v1/workspaces/${workspaceId}/anomalies/${alertId}/acknowledge`,
        { method: "POST" },
        token
      ),
    auditLog: (
      workspaceId: string,
      params: { action?: string; page?: number; size?: number },
      token: string
    ) => {
      const qs = new URLSearchParams();
      if (params.action) qs.set("action", params.action);
      qs.set("page", String(params.page ?? 1));
      qs.set("size", String(params.size ?? 50));
      return request<AuditLogPageOut>(`/v1/workspaces/${workspaceId}/audit-log?${qs}`, {}, token);
    },
  },
  webhooks: {
    list: (workspaceId: string, token: string) =>
      request<WebhookOut[]>(`/v1/workspaces/${workspaceId}/webhooks`, {}, token),
    create: (
      workspaceId: string,
      body: { name: string; url: string; events: string[] },
      token: string
    ) =>
      request<WebhookCreatedOut>(
        `/v1/workspaces/${workspaceId}/webhooks`,
        { method: "POST", body: JSON.stringify(body) },
        token
      ),
    delete: (workspaceId: string, subscriptionId: string, token: string) =>
      request<void>(
        `/v1/workspaces/${workspaceId}/webhooks/${subscriptionId}`,
        { method: "DELETE" },
        token
      ),
    events: (workspaceId: string, token: string) =>
      request<string[]>(`/v1/workspaces/${workspaceId}/webhooks/events`, {}, token),
  },
};

export type ApiKeyOut = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
};

export type ApiKeyCreatedOut = ApiKeyOut & { key: string };

export type WebhookOut = {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  events: string[];
  secret_prefix: string;
  status: string;
  created_at: string;
};

export type WebhookCreatedOut = WebhookOut & { secret: string };

export type KpiOut = {
  invocations: number;
  hours_saved: number;
  active_agents: number;
  p95_latency_ms: number;
  tool_calls: number;
  vetting_runs_completed: number;
  documents_uploaded: number;
  range_days: number;
};

export type ComputeCostOut = {
  total_tokens: number;
  runs: number;
  active_seconds: number;
  utilization_pct: number;
  marginal_usd_per_1m: number;
  effective_usd_per_1m: number;
  compute_cost_usd: number;
  cloud_equivalent_usd: number;
  savings_vs_cloud_usd: number;
  cloud_reference_name: string;
  range_days: number;
};

export type TimeseriesPointOut = {
  day: string;
  invocations: number;
  tool_calls: number;
  avg_latency_ms: number;
};

export type AgentLeaderboardRowOut = {
  agent_id: string;
  name: string;
  invocations: number;
  success_rate: number;
  p95_latency_ms: number;
  hours_saved: number;
};

export type AnomalyOut = {
  id: string;
  metric_name: string;
  threshold_kind: string;
  threshold_value: number;
  observed_value: number;
  status: string;
  severity: string;
  note: string;
  window_start: string;
  window_end: string;
  created_at: string;
};

export type AnomalyEvalOut = {
  rule_id: string;
  metric: string;
  fired: boolean;
  observed_value: number;
  threshold: number;
  z_score: number | null;
};

export type AuditLogPageOut = {
  items: {
    id: string;
    timestamp: string;
    actor_user_id: string | null;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    outcome: string;
    metadata: Record<string, unknown>;
  }[];
  total: number;
  page: number;
  size: number;
};

export type VettingRunOut = {
  id: string;
  agent_id: string;
  workspace_id: string;
  classification: string;
  status: string;
  outcome: string | null;
  triggered_by: string;
  approved_by: string | null;
  approval_decision: string | null;
  approval_note: string | null;
  finding_summary: {
    total?: number;
    by_severity?: Record<string, number>;
    by_type?: Record<string, number>;
  };
  started_at: string;
  completed_at: string | null;
};

export type VettingFindingOut = {
  id: string;
  finding_type: string;
  severity: string;
  location: string;
  matched_preview: string;
  matched_full: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type MCPServerOut = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  url: string;
  transport: string;
  is_builtin: boolean;
  status: string;
  has_auth?: boolean;
};

export type ToolOut = {
  id: string;
  mcp_server_id: string;
  workspace_id: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  status: string;
};

export type ToolInvocationOut = {
  id: string;
  tool_id: string | null;
  agent_id: string | null;
  outcome: string;
  latency_ms: number;
  output_preview: string;
  error: string | null;
  images?: { data_url: string }[];
};

export type KBOut = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  scope: string;
  agent_id: string | null;
  status: string;
  created_at: string;
  /** Filled on list responses; 0 on create/get. */
  document_count?: number;
};

export type KBDocumentOut = {
  id: string;
  kb_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  error_detail: string | null;
  page_count: number | null;
  token_count: number | null;
  created_at: string;
};

export type KBUploadAcceptedOut = {
  document_id: string;
  status: string;
  duplicate: boolean;
  message: string;
};

export type KBSearchResultItem = {
  chunk_id: string;
  document_id: string;
  filename: string;
  content: string;
  chunk_metadata: Record<string, unknown>;
  score: number;
  rrf_score: number;
};

export type KBSearchOut = {
  results: KBSearchResultItem[];
  total: number;
};
