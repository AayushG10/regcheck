import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, CheckCircle2, XCircle, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ClauseLink from "./ClauseLink";
import { api, type Rule, type AmendmentResult } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/** Rules whose primary param this UI knows how to tighten. */
function isSimulatable(rule: Rule) {
  return rule.check_type === "periodicity_check" && "periodicity_days" in rule.params;
}

export default function AmendmentSimulator() {
  const { data: rules, loading } = useApi(() => api.getRules());
  const simulatable = useMemo(() => (rules ?? []).filter(isSimulatable), [rules]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [periodicity, setPeriodicity] = useState<number>(182);
  const [result, setResult] = useState<AmendmentResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  const selectedRule = simulatable.find((r) => r.id === selectedId) ?? simulatable[0];

  useEffect(() => {
    if (simulatable.length && !selectedId) {
      // Default to the VAPT rule — the flagship "6mo -> 3mo" demo scenario.
      const vapt = simulatable.find((r) => r.id === "rule-vapt-half-yearly");
      const initial = vapt ?? simulatable[0];
      setSelectedId(initial.id);
      setPeriodicity(initial.params.periodicity_days as number);
    }
  }, [simulatable, selectedId]);

  useEffect(() => {
    if (selectedRule) setPeriodicity(selectedRule.params.periodicity_days as number);
    setResult(null);
  }, [selectedRule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runSimulation(days: number) {
    if (!selectedRule) return;
    setSimulating(true);
    try {
      const res = await api.simulateAmendment(selectedRule.id, { periodicity_days: days });
      setResult(res);
    } finally {
      setSimulating(false);
    }
  }

  if (loading || !selectedRule) {
    return (
      <div>
        <PageHeader title="Amendment Simulator" subtitle="Loading amendable rules…" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const originalDays = selectedRule.params.periodicity_days as number;

  return (
    <div>
      <PageHeader
        title="Amendment Simulator"
        subtitle="SEBI tightens a rule — tighten one parameter here and watch every affected verdict re-run live, deterministically, with no LLM involved."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Wand2 className="h-4 w-4 text-brand-600" /> Choose a rule to amend
            </div>

            <div className="space-y-2">
              {simulatable.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => setSelectedId(rule.id)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                    rule.id === selectedRule.id
                      ? "border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-700 dark:bg-brand-900/20 dark:text-brand-200"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60"
                  )}
                >
                  <div className="font-medium">{rule.title}</div>
                  <div className="mt-0.5 text-xs opacity-70">Para {rule.citation.para}</div>
                </button>
              ))}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">Required periodicity</span>
                <span className="font-bold text-brand-700 dark:text-brand-400">
                  every {periodicity} days (~{(periodicity / 30).toFixed(1)} mo)
                </span>
              </div>
              <input
                type="range"
                min={30}
                max={Math.max(originalDays, 200)}
                step={1}
                value={periodicity}
                onChange={(e) => setPeriodicity(Number(e.target.value))}
                className="w-full accent-brand-700"
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>Tighter (30 days)</span>
                <span>Original: {originalDays} days</span>
              </div>

              <Button className="mt-5 w-full" disabled={simulating} onClick={() => runSimulation(periodicity)}>
                <Sparkles className="h-4 w-4" />
                {simulating ? "Re-running deterministic check…" : "Simulate amendment"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {result ? (
              <FlipCard key={`${result.rule_id}-${periodicity}`} result={result} />
            ) : (
              <Card className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
                <Wand2 className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                <p className="max-w-xs text-sm text-slate-400">
                  Drag the slider and click "Simulate amendment" to see the verdict re-run against the
                  same broker data with the new threshold.
                </p>
              </Card>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function FlipCard({ result }: { result: AmendmentResult }) {
  const before = result.before.verdict;
  const after = result.after.verdict;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn("overflow-hidden", result.flipped && "ring-2 ring-amber-300 dark:ring-amber-700")}>
        <CardContent className="p-6">
          {result.flipped && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
            >
              <Sparkles className="h-4 w-4" /> Verdict flipped — this amendment changes your compliance status.
            </motion.div>
          )}

          <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{result.rule_title}</div>
          <div className="mb-6">
            <ClauseLink clauseId={result.clause_id} citation={result.citation} />
          </div>

          <div className="flex items-center justify-center gap-6">
            <VerdictBadge label="Before" verdict={before} sub={`every ${result.original_params.periodicity_days} days`} />
            <motion.div
              animate={{ x: [0, 6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowRight className="h-6 w-6 text-slate-300 dark:text-slate-600" />
            </motion.div>
            <VerdictBadge
              label="After"
              verdict={after}
              sub={`every ${result.amended_params.periodicity_days} days`}
              highlight={result.flipped}
            />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-xs dark:border-slate-800">
            <div>
              <div className="mb-1 font-semibold text-slate-500 dark:text-slate-400">Before — explanation</div>
              <p className="text-slate-600 dark:text-slate-300">{result.before.explanation}</p>
            </div>
            <div>
              <div className="mb-1 font-semibold text-slate-500 dark:text-slate-400">After — explanation</div>
              <p className="text-slate-600 dark:text-slate-300">{result.after.explanation}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function VerdictBadge({
  label,
  verdict,
  sub,
  highlight,
}: {
  label: string;
  verdict: string;
  sub: string;
  highlight?: boolean;
}) {
  const isPass = verdict === "PASS";
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <motion.div
        animate={highlight ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.6 }}
        className={cn(
          "flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-2xl border-2",
          isPass
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
            : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300"
        )}
      >
        {isPass ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
        <span className="text-xs font-bold">{verdict}</span>
      </motion.div>
      <Badge variant="neutral" className="text-[10px]">{sub}</Badge>
    </div>
  );
}
