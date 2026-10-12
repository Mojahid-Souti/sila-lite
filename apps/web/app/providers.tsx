"use client";

import { startAuthRefresh, stopAuthRefresh } from "@/lib/auth-refresh";
import { cleanupLocalStorage } from "@/lib/storage-cleanup";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60 * 1000, retry: 1 },
        },
      })
  );
  // One-time localStorage hygiene: drop stale wekala_* keys + namespace legacy tokens.
  useEffect(() => {
    cleanupLocalStorage();
    // Keep the session alive by refreshing the access token before it expires
    // (the token is short-lived by design; this is what makes a session last
    // hours instead of dying at the first expiry).
    startAuthRefresh();
    return () => stopAuthRefresh();
  }, []);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
