import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, CheckCircle2, XCircle, ArrowRight, Sparkles, ListChecks } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import ClauseLink from "./ClauseLink";
import { api, ApiError, type Rule, type AmendmentResult } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * Describes which single numeric parameter of a rule this UI can tighten/loosen,
 * and how to present it. Generalized across every check_type that has a single
 * clear "threshold" knob, rather than hardcoding to periodicity rules only —
 * SEBI is just as likely to tighten a net-worth ratio or a filing window as a
 * periodicity requirement.
 */
interface AmendableParam {
  key: string;
  label: string;
  originalValue: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

function getAmendableParam(rule: Rule): AmendableParam | null {
  const p = rule.params as Record<string, unknown>;

  if (rule.check_type === "periodicity_check" && typeof p.periodicity_days === "number") {
    const v = p.periodicity_days as number;
    return {
      key: "periodicity_days",
      label: "Required periodicity",
      originalValue: v,
      min: 30,
      max: Math.max(v, 200),
      step: 1,
      format: (x) => `every ${x} days (~${(x / 30).toFixed(1)} mo)`,
    };
  }

  if (rule.check_type === "ratio_threshold" && typeof p.threshold === "number") {
    const v = p.threshold as number;
    return {
      key: "threshold",
      label: `Required ratio (${p.operator})`,
      originalValue: v,
      min: 0.1,
      max: 1.0,
      step: 0.01,
      format: (x) => `${(x * 100).toFixed(0)}%`,
    };
  }

  if (rule.check_type === "days_since_threshold" && typeof p.max_days === "number") {
    const v = p.max_days as number;
    return {
      key: "max_days",
      label: "Allowed filing window",
      originalValue: v,
      min: 1,
      max: Math.max(v * 2, 14),
      step: 1,
      format: (x) => `${x} days`,
    };
  }

  if (rule.check_type === "no_further_exposure_after_days" && typeof p.trading_days_threshold === "number") {
    const v = p.trading_days_threshold as number;
    return {
      key: "trading_days_threshold",
      label: "Trading-day threshold",
      originalValue: v,
      min: 1,
      max: Math.max(v * 2, 10),
      step: 1,
      format: (x) => `${x} trading days`,
    };
  }

  return null;
}

export default function AmendmentSimulator() {
  const { data: rules, loading, error } = useApi(() => api.getRules());
  const simulatable = useMemo(() => (rules ?? []).filter((r) => getAmendableParam(r) !== null), [rules]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [value, setValue] = useState<number>(0);
  const [result, setResult] = useState<AmendmentResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const selectedRule = simulatable.find((r) => r.id === selectedId) ?? simulatable[0];
  const param = selectedRule ? getAmendableParam(selectedRule) : null;

  useEffect(() => {
    if (simulatable.length && !selectedId) {
      // Default to the VAPT rule — the flagship "6mo -> 3mo" demo scenario.
      const vapt = simulatable.find((r) => r.id === "rule-vapt-half-yearly");
      const initial = vapt ?? simulatable[0];
      setSelectedId(initial.id);
      const p = getAmendableParam(initial);
      if (p) setValue(p.originalValue);
    }
  }, [simulatable, selectedId]);

  useEffect(() => {
    if (param) setValue(param.originalValue);
    setResult(null);
    setSimError(null);
  }, [selectedRule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runSimulation() {
    if (!selectedRule || !param) return;
    setSimulating(true);
    setSimError(null);
    try {
      const res = await api.simulateAmendment(selectedRule.id, { [param.key]: value });
      setResult(res);
    } catch (err) {
      setSimError(err instanceof ApiError ? err.message : "Simulation failed");
    } finally {
      setSimulating(false);
    }
  }

  if (loading || (!selectedRule && !error)) {
    return (
      <div>
        <PageHeader title="Amendment Simulator" subtitle="Loading amendable rules…" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !selectedRule || !param) {
    return (
      <div>
        <PageHeader title="Amendment Simulator" subtitle="Tighten a rule and watch the verdict re-run." />
        <ErrorCard message={error ?? "No amendable rules found."} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Amendment Simulator"
        subtitle="SEBI tightens a rule — adjust one parameter here and watch the deterministic engine re-run the entire scorecard, live, with no LLM involved."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Wand2 className="h-4 w-4 text-brand-600" /> Choose a rule to amend
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
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
                <span className="font-medium text-slate-700 dark:text-slate-200">{param.label}</span>
                <span className="font-bold text-brand-700 dark:text-brand-400">{param.format(value)}</span>
              </div>
              <input
                type="range"
                min={param.min}
                max={param.max}
                step={param.step}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full accent-brand-700"
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-400">
                <span>{param.format(param.min)}</span>
                <span>Original: {param.format(param.originalValue)}</span>
              </div>

              <Button className="mt-5 w-full" disabled={simulating} onClick={runSimulation}>
                <Sparkles className="h-4 w-4" />
                {simulating ? "Re-running deterministic check…" : "Simulate amendment"}
              </Button>

              {simError && (
                <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{simError}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {result ? (
              <FlipCard key={`${result.rule_id}-${value}`} result={result} param={param} />
            ) : (
              <Card className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-10 text-center">
                <Wand2 className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                <p className="max-w-xs text-sm text-slate-400">
                  Drag the slider and click "Simulate amendment" to re-run the whole scorecard against the
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

function FlipCard({ result, param }: { result: AmendmentResult; param: AmendableParam }) {
  const before = result.before.verdict;
  const after = result.after.verdict;
  const diff = result.scorecard_diff;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
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
            <VerdictBadge
              label="Before"
              verdict={before}
              sub={param.format(result.original_params[param.key] as number)}
            />
            <motion.div
              animate={{ x: [0, 6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowRight className="h-6 w-6 text-slate-300 dark:text-slate-600" />
            </motion.div>
            <VerdictBadge
              label="After"
              verdict={after}
              sub={param.format(result.amended_params[param.key] as number)}
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

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <ListChecks className="h-4 w-4 text-brand-600" /> Full scorecard impact
          </div>
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-lg font-bold text-slate-900 dark:text-white">{diff.total_checked}</div>
              <div className="text-[11px] text-slate-400">obligations checked</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {diff.before_passed} → {diff.after_passed}
              </div>
              <div className="text-[11px] text-slate-400">passing before → after</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {diff.changed_count} / {diff.unchanged_count}
              </div>
              <div className="text-[11px] text-slate-400">flipped / unchanged</div>
            </div>
          </div>

          {diff.changed.length > 0 ? (
            <div className="space-y-2">
              {diff.changed.map((c) => (
                <div
                  key={c.rule_id}
                  className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-900/10"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200">{c.rule_title}</span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Badge variant={c.before_verdict === "PASS" ? "pass" : "fail"}>{c.before_verdict}</Badge>
                    <ArrowRight className="h-3 w-3 text-slate-400" />
                    <Badge variant={c.after_verdict === "PASS" ? "pass" : "fail"}>{c.after_verdict}</Badge>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              No other obligation's verdict changed — this amendment only affects the rule above.
            </p>
          )}
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
