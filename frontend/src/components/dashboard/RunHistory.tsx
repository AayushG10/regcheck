import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronDown, Play, History, Tag, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import { api, ApiError, type Verdict } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const VERDICT_ICON: Record<Verdict, typeof CheckCircle2> = {
  PASS: CheckCircle2,
  FAIL: XCircle,
  NOT_APPLICABLE: MinusCircle,
};

/**
 * The audit trail, made visible: every past scorecard run is persisted
 * immutably (see backend/app/api/routes.py::run_checks and
 * ::commit_amendment) with the exact rule version and evidence used, so
 * "what did we report as of a given date, and prove it" has a real,
 * reproducible answer instead of the dashboard only ever being able to
 * recompute the *current* state.
 */
export default function RunHistory() {
  const { data: runs, loading, error, refetch } = useApi(() => api.getRuns());
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  async function handleRunNow() {
    setTriggering(true);
    try {
      const run = await api.runChecks();
      toast.success("New check run recorded", {
        description: `${run.passed} passed, ${run.failed} failed — permanently logged to the audit trail.`,
      });
      setOpenRunId(run.run_id);
      refetch();
    } catch (err) {
      toast.error("Run failed", { description: err instanceof ApiError ? err.message : "Unknown error" });
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Run History"
        subtitle="Every scorecard run, persisted immutably — the rule versions and evidence behind any past verdict, always reproducible."
        onRefresh={refetch}
      />

      <Card className="mb-6 flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
            <History className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Record a new run</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Snapshots the current scorecard permanently — distinct from the live view, which recomputes on every visit.
            </div>
          </div>
        </div>
        <Button size="sm" disabled={triggering} onClick={handleRunNow}>
          <Play className="h-3.5 w-3.5" /> {triggering ? "Running…" : "Run now"}
        </Button>
      </Card>

      {error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : loading || !runs ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : runs.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <History className="h-8 w-8 text-slate-300 dark:text-slate-700" />
          <p className="max-w-xs text-sm text-slate-400">
            No runs recorded yet. Click "Run now" to persist the first audit-trail entry.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {runs.map((run, i) => (
            <motion.div
              key={run.run_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
            >
              <Card className="overflow-hidden">
                <button
                  onClick={() => setOpenRunId(openRunId === run.run_id ? null : run.run_id)}
                  className="flex w-full flex-wrap items-center gap-4 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {new Date(run.run_at).toLocaleString()}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        <Tag className="h-2.5 w-2.5" /> engine v{run.engine_version}
                      </Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {run.broker_name} · as of {run.as_of_date} · {run.total_checked} obligations checked
                    </div>
                  </div>
                  <Badge variant="pass">{run.passed} passed</Badge>
                  <Badge variant="fail">{run.failed} failed</Badge>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-slate-400 transition-transform",
                      openRunId === run.run_id && "rotate-180"
                    )}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openRunId === run.run_id && <RunDetail runId={run.run_id} />}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunDetail({ runId }: { runId: string }) {
  const { data: run, loading } = useApi(() => api.getRun(runId), [runId]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
    >
      <CardContent className="border-t border-slate-100 pt-4 dark:border-slate-800">
        {loading || !run ? (
          <Skeleton className="h-40" />
        ) : (
          <div className="space-y-2">
            {run.results.map((r) => {
              const Icon = VERDICT_ICON[r.verdict];
              return (
                <div
                  key={r.rule_id}
                  className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      r.verdict === "PASS" && "text-emerald-500",
                      r.verdict === "FAIL" && "text-rose-500",
                      r.verdict === "NOT_APPLICABLE" && "text-slate-400"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{r.rule_title}</div>
                    <div className="text-[10px] text-slate-400">
                      rule v{r.rule_version} · Para {r.citation.para}
                    </div>
                  </div>
                  <Badge variant={r.verdict === "PASS" ? "pass" : r.verdict === "FAIL" ? "fail" : "neutral"}>
                    {r.verdict}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </motion.div>
  );
}
