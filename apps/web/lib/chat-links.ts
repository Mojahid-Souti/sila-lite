import { ROUTES } from "@/lib/constants";

/**
 * Links into the SILA chat. The chat reads `template` (one built-in template)
 * and `skill` (a comma-separated list of Bazaar skill IDs); the server still
 * whitelists both — these are IDs, never prompt text.
 */
export function chatHref({
  template,
  skills = [],
}: { template?: string; skills?: string[] }): string {
  const params = new URLSearchParams();
  if (template) params.set("template", template);
  if (skills.length) params.set("skill", skills.join(","));
  const query = params.toString();
  return query ? `${ROUTES.dashboard}?${query}` : ROUTES.dashboard;
}

export const templateChatHref = (template: string, skills: string[] = []) =>
  chatHref({ template, skills });

export const skillChatHref = (skill: string) => chatHref({ skills: [skill] });

/** The `skill` parameter as IDs (deduplicated, empty entries dropped). */
export function parseSkillParam(value: string | null): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}
