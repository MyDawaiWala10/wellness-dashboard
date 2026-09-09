"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "./ui/button";
import { Loader2, RefreshCw, WifiOff } from "lucide-react";

interface QueryWrapperProps {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
  /** Auto-retry count for network errors (default: 2) */
  autoRetryCount?: number;
  /** Delay between auto-retries in ms (default: 3000) */
  autoRetryDelay?: number;
}

function isNetworkError(error?: Error | null): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("fetch failed") ||
    msg.includes("econnrefused") ||
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror")
  );
}

export function QueryWrapper({
  isLoading,
  isError,
  error,
  onRetry,
  skeleton,
  children,
  autoRetryCount = 2,
  autoRetryDelay = 3000,
}: QueryWrapperProps) {
  const [retriesLeft, setRetriesLeft] = useState(autoRetryCount);
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);

  const doRetry = useCallback(() => {
    setIsAutoRetrying(true);
    setRetriesLeft((prev) => prev - 1);
    onRetry?.();
  }, [onRetry]);

  // Auto-retry on network errors
  useEffect(() => {
    if (!isError || retriesLeft <= 0 || !isNetworkError(error) || !onRetry) return;

    const timer = setTimeout(() => {
      doRetry();
    }, autoRetryDelay);

    return () => clearTimeout(timer);
  }, [isError, retriesLeft, error, onRetry, autoRetryDelay, doRetry]);

  // Reset retries when loading starts (new fetch)
  useEffect(() => {
    if (isLoading) {
      setRetriesLeft(autoRetryCount);
      setIsAutoRetrying(false);
    }
  }, [isLoading, autoRetryCount]);

  if (isLoading) {
    return skeleton ? <>{skeleton}</> : <DefaultSkeleton />;
  }

  if (isError) {
    const isNetwork = isNetworkError(error);

    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-md border border-destructive/30 bg-destructive/5">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-destructive font-medium">
          {isNetwork
            ? "Unable to connect to server"
            : error?.message ?? "Something went wrong"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isNetwork
            ? retriesLeft > 0
              ? `Retrying in ${autoRetryDelay / 1000}s... (${retriesLeft} attempts left)`
              : "Check your connection and try again"
            : "Please try again or contact support if the issue persists"}
        </p>
        {(!isNetwork || retriesLeft <= 0) && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRetriesLeft(autoRetryCount);
              onRetry();
            }}
            className="mt-2"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

function DefaultSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
      <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
      <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
    </div>
  );
}