import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@zorin/ui/ui/components/button";
import { Spinner } from "@zorin/ui/ui/components/spinner";

interface PageLoadStateProps {
  error?: string | null;
  label: string;
  loading?: boolean;
  onRetry?: () => void;
}

/** Consistent, accessible loading/error feedback for management routes. */
export function PageLoadState({
  error,
  label,
  loading = false,
  onRetry,
}: PageLoadStateProps) {
  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="flex min-h-48 w-full items-center justify-center border border-border bg-card/90 px-5 py-12"
        role="status"
      >
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner className="text-lg text-primary" />
          <span>{label}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex w-full min-w-0 flex-col gap-3 border border-destructive/40 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center"
      role="alert"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {error ? (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <Button
          className="self-start sm:self-auto"
          ghost
          onClick={onRetry}
          prefix={<RefreshCw className="h-3.5 w-3.5" />}
          size="sm"
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}
