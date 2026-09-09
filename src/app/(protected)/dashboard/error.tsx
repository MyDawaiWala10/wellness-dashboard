"use client"; // Error components must be Client Components

import { useEffect, useState, useCallback } from "react";
import { CloudOff, RefreshCw, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

/**
 * Friendly fallback when a dashboard route throws.
 *
 * Tone goal: reassuring, not alarming. Owners and back-office staff are not
 * developers - a red wall of text reads like the system is broken when in
 * practice the page usually recovers on a refresh.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retriesLeft, setRetriesLeft] = useState(3);

  const isNetworkError =
    error.message?.toLowerCase().includes("fetch failed") ||
    error.message?.toLowerCase().includes("econnrefused") ||
    error.message?.toLowerCase().includes("network");

  const doRetry = useCallback(() => {
    setIsRetrying(true);
    setRetriesLeft((prev) => prev - 1);
    setTimeout(() => {
      reset?.();
    }, 1500);
  }, [reset]);

  // Auto-retry on network errors
  useEffect(() => {
    if (isNetworkError && retriesLeft > 0 && !isRetrying) {
      const timer = setTimeout(() => {
        doRetry();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isNetworkError, retriesLeft, isRetrying, doRetry]);

  useEffect(() => {
    // Surface to dev tools so engineers can debug;
    // user only sees the friendly message.
    console.error("[dashboard error boundary]", error);
  }, [error]);

  // Show error digest only in non-production builds so staff don't see noise.
  const showDetail = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <CloudOff className="h-10 w-10 text-muted-foreground" aria-hidden />
      </div>

      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          {isNetworkError ? "Connection issue" : "We hit a small hiccup"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isNetworkError
            ? retriesLeft > 0
              ? `Unable to reach the server. Retrying in a moment... (${retriesLeft} attempts left)`
              : "Unable to reach the server. Please check your connection and try again."
            : "The page couldn't load this time. Usually a refresh fixes it. If it keeps happening, let your developer know."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {isRetrying ? (
          <Button variant="default" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Reconnecting...
          </Button>
        ) : (
          <Button
            variant="default"
            onClick={() => {
              if (reset) {
                reset();
              } else {
                window.location.reload();
              }
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Try again
          </Button>
        )}
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Back to dashboard
        </Button>
      </div>

      {showDetail && (
        <details className="mt-4 max-w-xl text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Show technical details
          </summary>
          <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs">
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ""}
          </pre>
        </details>
      )}
    </div>
  );
}
