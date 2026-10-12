import { cn } from "@/lib/utils";
import {
  SiAirtable,
  SiAnthropic,
  SiAsana,
  SiAtlassian,
  SiCloudflare,
  SiConfluence,
  SiDiscord,
  SiDocker,
  SiFigma,
  SiGithub,
  SiGitlab,
  SiGmail,
  SiGoogle,
  SiGooglecalendar,
  SiGooglechat,
  SiGooglecloud,
  SiGoogledocs,
  SiGoogledrive,
  SiGoogleforms,
  SiGooglesheets,
  SiGoogletasks,
  SiHubspot,
  SiHuggingface,
  SiJira,
  SiLinear,
  SiMongodb,
  SiN8n,
  SiNotion,
  SiOllama,
  SiPostgresql,
  SiRedis,
  SiSentry,
  SiShopify,
  SiStripe,
  SiSupabase,
  SiTelegram,
  SiTrello,
  SiVercel,
  SiZapier,
} from "@icons-pack/react-simple-icons";
import { Mail, Plug } from "lucide-react";

type BrandIcon = React.ComponentType<{ color?: string; size?: number; className?: string }>;

/** Official Slack mark — the open icon packs dropped brand icons, so it's inlined. */
export function SlackBrandIcon({ className }: { color?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#E01E5A"
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      />
      <path
        fill="#36C5F0"
        d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      />
      <path
        fill="#2EB67D"
        d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
      />
      <path
        fill="#ECB22E"
        d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
      />
    </svg>
  );
}

/** Microsoft forced its brand marks out of the open icon packs — a tinted
 *  neutral glyph beats a generic plug. */
function tinted(Cmp: BrandIcon, tint: string): BrandIcon {
  return function Tinted({ className }: { color?: string; className?: string }) {
    return <Cmp className={cn(tint, className)} />;
  };
}

/** An official brand PNG under /public/icons — used where the open icon packs
 *  lack the mark (Microsoft products, ClickUp). Rendered square + contained so it
 *  fits the same size box as the vector icons. */
function img(src: string, alt: string): BrandIcon {
  return function ImgIcon({ className }: { color?: string; className?: string }) {
    return <img src={src} alt={alt} className={cn("object-contain", className)} />;
  };
}

// Auto-detect the service from an MCP server's name/URL. First match wins, so
// keep more-specific keywords above their parent brand (e.g. Jira before
// Atlassian, Google Cloud before Google). Add a row to support a new connector.
const REGISTRY: { keywords: string[]; Icon: BrandIcon }[] = [
  { keywords: ["huggingface", "hugging face", "hugging-face"], Icon: SiHuggingface },
  { keywords: ["gitlab"], Icon: SiGitlab },
  { keywords: ["github"], Icon: SiGithub },
  { keywords: ["ollama"], Icon: SiOllama },
  { keywords: ["anthropic", "claude"], Icon: SiAnthropic },
  { keywords: ["cloudflare"], Icon: SiCloudflare },
  { keywords: ["notion"], Icon: SiNotion },
  { keywords: ["confluence"], Icon: SiConfluence },
  { keywords: ["jira"], Icon: SiJira },
  { keywords: ["atlassian"], Icon: SiAtlassian },
  { keywords: ["supabase"], Icon: SiSupabase },
  { keywords: ["postgres"], Icon: SiPostgresql },
  { keywords: ["mongodb", "mongo"], Icon: SiMongodb },
  { keywords: ["redis"], Icon: SiRedis },
  { keywords: ["docker"], Icon: SiDocker },
  { keywords: ["vercel"], Icon: SiVercel },
  { keywords: ["figma"], Icon: SiFigma },
  { keywords: ["zapier"], Icon: SiZapier },
  { keywords: ["airtable"], Icon: SiAirtable },
  { keywords: ["hubspot"], Icon: SiHubspot },
  { keywords: ["shopify"], Icon: SiShopify },
  { keywords: ["clickup"], Icon: img("/icons/icons8-clickup-50.png", "ClickUp") },
  { keywords: ["asana"], Icon: SiAsana },
  { keywords: ["trello"], Icon: SiTrello },
  { keywords: ["stripe"], Icon: SiStripe },
  { keywords: ["sentry"], Icon: SiSentry },
  { keywords: ["linear"], Icon: SiLinear },
  { keywords: ["n8n"], Icon: SiN8n },
  // Microsoft — official brand PNGs (/public/icons). ABOVE the Google block so
  // "onedrive" beats the broad "drive", and "outlook calendar" beats "calendar".
  // Keep more-specific MS keywords first ("outlook calendar" before "outlook").
  {
    keywords: ["outlook calendar"],
    Icon: img("/icons/icons8-microsoft-outlook-2025-50.png", "Outlook Calendar"),
  },
  { keywords: ["outlook"], Icon: img("/icons/icons8-microsoft-outlook-2025-50.png", "Outlook") },
  {
    keywords: ["teams"],
    Icon: img("/icons/icons8-microsoft-teams-2025-50.png", "Microsoft Teams"),
  },
  { keywords: ["to do", "todo"], Icon: img("/icons/icons8-microsoft-todo-2019-50.png", "To Do") },
  { keywords: ["onenote"], Icon: img("/icons/icons8-microsoft-onenote-2025-50.png", "OneNote") },
  { keywords: ["onedrive"], Icon: img("/icons/icons8-microsoft-onedrive-2025-50.png", "OneDrive") },
  { keywords: ["excel"], Icon: img("/icons/icons8-microsoft-excel-2019-50.png", "Excel") },
  {
    keywords: ["powerpoint"],
    Icon: img("/icons/icons8-microsoft-powerpoint-2025-50.png", "PowerPoint"),
  },
  {
    keywords: ["power bi", "powerbi"],
    Icon: img("/icons/icons8-power-bi-2021-50.png", "Power BI"),
  },
  {
    keywords: ["sharepoint"],
    Icon: img("/icons/icons8-microsoft-sharepoint-2019-50.png", "SharePoint"),
  },
  { keywords: ["word"], Icon: img("/icons/icons8-microsoft-word-2025-50.png", "Word") },
  // Specific Google products before the generic "google" catch-all (first match wins).
  { keywords: ["gmail"], Icon: SiGmail },
  { keywords: ["google sheets", "sheets", "googlesheets"], Icon: SiGooglesheets },
  { keywords: ["google calendar", "calendar", "googlecalendar"], Icon: SiGooglecalendar },
  { keywords: ["google docs", "docs", "googledocs"], Icon: SiGoogledocs },
  { keywords: ["google drive", "drive", "googledrive"], Icon: SiGoogledrive },
  { keywords: ["google chat", "googlechat"], Icon: SiGooglechat },
  { keywords: ["google tasks", "googletasks"], Icon: SiGoogletasks },
  { keywords: ["google forms", "googleforms"], Icon: SiGoogleforms },
  { keywords: ["google cloud", "gcp", "googlecloud"], Icon: SiGooglecloud },
  // Google Contacts has no simple-icons mark — the generic Google catch-all covers it.
  { keywords: ["google"], Icon: SiGoogle },
  { keywords: ["discord"], Icon: SiDiscord },
  { keywords: ["telegram"], Icon: SiTelegram },
  { keywords: ["slack"], Icon: SlackBrandIcon },
  { keywords: ["email"], Icon: tinted(Mail, "text-neutral-500") },
];

/**
 * Renders the brand logo for an MCP connector (in the service's official color),
 * detected from its name/URL. Falls back to a generic plug for unknown services.
 */
export function ConnectorIcon({
  name,
  url,
  className = "size-5",
}: {
  name: string;
  url?: string | null;
  className?: string;
}) {
  const haystack = `${name} ${url ?? ""}`.toLowerCase();
  const match = REGISTRY.find((r) => r.keywords.some((k) => haystack.includes(k)));
  if (match) {
    const Icon = match.Icon;
    return <Icon color="default" className={className} />;
  }
  return <Plug className={className} />;
}
