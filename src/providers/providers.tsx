"use client";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AUTH_REFRESH_FAILED_CODE } from "@/lib/auth-errors";
import { signalSessionExpired } from "@/components/session-expired-dialog";

function isAuthError(error: Error): boolean {
  return (
    error.name === "AuthRefreshFailedError" ||
    error.message?.includes(AUTH_REFRESH_FAILED_CODE) ||
    error.message?.includes("Session expired")
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error: Error, query) => {
            // Log query key for debugging which endpoint failed
            const queryKey = query.queryKey?.[0] ?? "unknown";
            console.error(`[Query Error] ${queryKey}:`, error.message);

            if (isAuthError(error)) {
              signalSessionExpired();
              return;
            }
            // A background refresh failed (sleep, Wi-Fi blip, a deploy) while
            // the page still shows good data - stay quiet, the next poll recovers.
            if (query.state.data !== undefined) return;
            toast.error(error.message);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error: Error, _variables, _context, mutation) => {
            if (isAuthError(error)) {
              signalSessionExpired();
              return;
            }
            // Only toast here when the mutation has no onError of its own -
            // otherwise both fire and the user sees a duplicate toast.
            if (mutation.options.onError) return;
            toast.error(error.message);
          },
        }),
        defaultOptions: {
          queries: {
            retry: 1,
            // Cache until an explicit refresh. Data is fetched once and reused
            // across the session; it only re-hits the DB when a refresh button
            // (invalidateQueries) or a mutation invalidates the cache. No
            // time-based, mount, focus, or reconnect refetching.
            staleTime: Infinity,
            gcTime: Infinity,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}