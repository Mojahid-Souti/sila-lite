"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { startAuthRefresh } from "@/lib/auth-refresh";
import { getRefreshToken, getToken, rememberMePreferred, setTokens } from "@/lib/auth-storage";
import { ROUTES } from "@/lib/constants";
import { getOnboardingComplete } from "@/lib/jwt-user";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  Building2,
  Code,
  Loader2,
  MoreHorizontal,
  Presentation,
  Rocket,
  Search,
  Settings,
  Share2,
  Sparkles,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconCardGroup, type IconCardOption } from "./icon-card-group";

type StepKey = "referral_source" | "job_role" | "agent_experience";
type Answers = Record<StepKey, string | null>;

export function OnboardingWizard() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    referral_source: null,
    job_role: null,
    agent_experience: null,
  });
  // Free text captured when a step's "Other" card is chosen (referral + role only).
  const [otherText, setOtherText] = useState<Record<StepKey, string>>({
    referral_source: "",
    job_role: "",
    agent_experience: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // A user who already finished onboarding never sees this page again.
  useEffect(() => {
    if (getOnboardingComplete(getToken())) {
      router.replace(ROUTES.dashboard);
    }
  }, [router]);

  const steps: { key: StepKey; title: string; subtitle: string; options: IconCardOption[] }[] = [
    {
      key: "referral_source",
      title: t("referralSource.title"),
      subtitle: t("referralSource.subtitle"),
      options: [
        { value: "colleague", label: t("referralSource.options.colleague"), icon: Users },
        { value: "linkedin", label: t("referralSource.options.linkedin"), icon: Share2 },
        { value: "conference", label: t("referralSource.options.conference"), icon: Presentation },
        { value: "search", label: t("referralSource.options.search"), icon: Search },
        { value: "omantel", label: t("referralSource.options.omantel"), icon: Building2 },
        { value: "other", label: t("referralSource.options.other"), icon: MoreHorizontal },
      ],
    },
    {
      key: "job_role",
      title: t("jobRole.title"),
      subtitle: t("jobRole.subtitle"),
      options: [
        { value: "executive", label: t("jobRole.options.executive"), icon: Briefcase },
        { value: "manager", label: t("jobRole.options.manager"), icon: UserCog },
        { value: "developer", label: t("jobRole.options.developer"), icon: Code },
        { value: "analyst", label: t("jobRole.options.analyst"), icon: BarChart3 },
        { value: "operations", label: t("jobRole.options.operations"), icon: Settings },
        { value: "other", label: t("jobRole.options.other"), icon: MoreHorizontal },
      ],
    },
    {
      key: "agent_experience",
      title: t("agentExperience.title"),
      subtitle: t("agentExperience.subtitle"),
      options: [
        { value: "never", label: t("agentExperience.options.never"), icon: Sparkles },
        { value: "some", label: t("agentExperience.options.some"), icon: Wrench },
        { value: "experienced", label: t("agentExperience.options.experienced"), icon: Rocket },
      ],
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const selected = current ? answers[current.key] : null;
  // "Other" needs a non-empty label before the user can advance.
  const needsOther = selected === "other";
  const otherFilled = current ? otherText[current.key].trim().length > 0 : false;
  const canAdvance = !!selected && (!needsOther || otherFilled);

  function choose(value: string) {
    if (!current) return;
    setAnswers((a) => ({ ...a, [current.key]: value }));
  }

  async function finish() {
    const { referral_source, job_role, agent_experience } = answers;
    if (!referral_source || !job_role || !agent_experience) return;
    setError("");
    setLoading(true);
    try {
      await api.auth.completeOnboarding(
        {
          referral_source,
          job_role,
          agent_experience,
          referral_source_other:
            referral_source === "other" ? otherText.referral_source.trim() : undefined,
          job_role_other: job_role === "other" ? otherText.job_role.trim() : undefined,
        },
        getToken()
      );
      // Refresh so the new onboarding_complete + ux_mode claims land in the JWT
      // before the app guard re-evaluates (otherwise it would bounce us back).
      const refresh = getRefreshToken();
      if (refresh) {
        const session = await api.auth.refresh(refresh);
        setTokens(session.access_token, session.refresh_token, {
          remember: rememberMePreferred(),
        });
        startAuthRefresh(); // arm silent refresh once the session token is set
      }
      router.replace(ROUTES.dashboard);
    } catch {
      setError(t("error"));
      setLoading(false);
    }
  }

  function next() {
    if (isLast) {
      void finish();
    } else {
      setStep((s) => s + 1);
    }
  }

  if (!current) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
      <div className="space-y-8">
        <Dots
          keys={steps.map((s) => s.key)}
          current={step}
          label={t("stepLabel", { current: step + 1, total: steps.length })}
        />

        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
            {current.title}
          </h1>
          <p className="text-sm text-neutral-500">{current.subtitle}</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <IconCardGroup
          options={current.options}
          value={selected}
          onChange={choose}
          ariaLabel={current.title}
        />

        {needsOther && (
          <input
            type="text"
            value={otherText[current.key]}
            onChange={(e) => setOtherText((o) => ({ ...o, [current.key]: e.target.value }))}
            maxLength={60}
            aria-label={t("otherLabel")}
            placeholder={t("otherPlaceholder")}
            className="h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm text-neutral-950 placeholder:text-neutral-400 transition-colors focus:border-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-200"
          />
        )}

        <div className="flex items-center justify-between pt-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900 disabled:opacity-50"
            >
              <ArrowLeft className="size-4" />
              {t("back")}
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={next}
            disabled={!canAdvance || loading}
            className="inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-6 text-sm font-medium text-white transition-all hover:bg-neutral-800 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("saving")}
              </>
            ) : isLast ? (
              t("finish")
            ) : (
              t("continue")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dots({ keys, current, label }: { keys: string[]; current: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2" aria-hidden>
        {keys.map((k, i) => (
          <span
            key={k}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === current ? "w-8 bg-neutral-950" : "w-1.5 bg-neutral-200"
            )}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-neutral-400">{label}</span>
    </div>
  );
}
