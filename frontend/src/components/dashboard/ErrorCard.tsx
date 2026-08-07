import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Shared error state for dashboard views. Every view fetches from the live
 * API — if the backend is unreachable or errors, this renders instead of an
 * indefinitely-spinning skeleton, so a demo failure is visible and
 * recoverable rather than silently looking frozen.
 */
export default function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 border-rose-200 bg-rose-50 p-10 text-center dark:border-rose-900 dark:bg-rose-950/30">
      <AlertTriangle className="h-8 w-8 text-rose-500" />
      <div>
        <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">Couldn't load this view</p>
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      )}
    </Card>
  );
}
