import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ClauseLink from "./ClauseLink";
import { api, type CheckResult } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const VERDICT_CONFIG = {
  PASS: { icon: CheckCircle2, badge: "pass" as const, ring: "ring-emerald-200 dark:ring-emerald-900" },
  FAIL: { icon: XCircle, badge: "fail" as const, ring: "ring-rose-200 dark:ring-rose-900" },
  NOT_APPLICABLE: { icon: MinusCircle, badge: "neutral" as const, ring: "ring-slate-200 dark:ring-slate-800" },
};

export default function Scorecard() {
  const { data, loading, error, refetch } = useApi(() => api.getReport());
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Compliance Scorecard"
        subtitle="Every obligation, its verdict, and the exact clause that proves it."
        onRefresh={refetch}
      />

      {error && (
        <Card className="mb-6 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          Failed to load report: {error}
        </Card>
      )}

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Broker" value={data.broker_name} small />
            <StatTile label="As of" value={data.as_of_date} small />
            <StatTile label="Passed" value={String(data.passed)} accent="text-emerald-600 dark:text-emerald-400" />
            <StatTile label="Failed" value={String(data.failed)} accent="text-rose-600 dark:text-rose-400" />
          </div>

          <div className="space-y-3">
            {data.results.map((r, i) => (
              <ResultRow
                key={r.rule_id}
                result={r}
                index={i}
                expanded={expanded === r.rule_id}
                onToggle={() => setExpanded(expanded === r.rule_id ? null : r.rule_id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value, accent, small }: { label: string; value: string; accent?: string; small?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className={cn("mt-1 truncate font-semibold", small ? "text-sm" : "text-2xl", accent)}>{value}</div>
    </Card>
  );
}

function ResultRow({
  result,
  index,
  expanded,
  onToggle,
}: {
  result: CheckResult;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = VERDICT_CONFIG[result.verdict];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Card className={cn("overflow-hidden transition-shadow", expanded && "ring-2", config.ring)}>
        <button onClick={onToggle} className="flex w-full items-center gap-4 p-4 text-left">
          <Icon
            className={cn(
              "h-5 w-5 shrink-0",
              result.verdict === "PASS" && "text-emerald-500",
              result.verdict === "FAIL" && "text-rose-500",
              result.verdict === "NOT_APPLICABLE" && "text-slate-400"
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{result.rule_title}</span>
              <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{result.category}</Badge>
            </div>
            <div className="mt-0.5 text-xs text-slate-400">{result.tier} tier</div>
          </div>
          <Badge variant={config.badge}>{result.verdict}</Badge>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")} />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <CardContent className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{result.explanation}</p>
                {Object.keys(result.evidence).length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Object.entries(result.evidence).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                        <div className="text-[10px] uppercase tracking-wide text-slate-400">{k.replace(/_/g, " ")}</div>
                        <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <ClauseLink clauseId={result.clause_id} citation={result.citation} />
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
