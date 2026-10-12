"use client";

import { api } from "@/lib/api";
import { useToken } from "@/lib/use-token";
import { useQuery } from "@tanstack/react-query";

/** The signed-in user. Matches what `GET /v1/auth/me` returns. */
export type Me = {
  id: string;
  email: string;
  email_confirmed?: boolean;
  full_name?: string | null;
};

/** Single source of truth for the identity query key. Anything that needs the
 *  current user must go through this hook — three components previously fetched
 *  `/auth/me` independently (two with raw effects, one with its own query key),
 *  so a single dashboard load issued the same request three times. */
export const ME_QUERY_KEY = ["auth-me"] as const;

/**
 * The signed-in user, fetched once and shared.
 *
 * TanStack Query dedupes by key, so concurrent callers collapse to one request
 * — including React's double-invoked effects in development, which is why this
 * replaces the hand-rolled `useEffect` + `fetch` versions rather than just
 * hoisting them. Identity rarely changes within a session, so it stays fresh
 * for five minutes; sign-out clears the cache with the token.
 *
 * O(1) per component — a cache read after the first caller resolves it.
 */
export function useMe(): { me: Me | null; loading: boolean } {
  const token = useToken();
  const { data, isLoading } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => api.auth.me(token) as Promise<Me>,
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
  return { me: data ?? null, loading: isLoading };
}
