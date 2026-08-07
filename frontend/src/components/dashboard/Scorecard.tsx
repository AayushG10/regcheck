import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { ChevronDown, CheckCircle2, XCircle, MinusCircle, Search, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import ClauseLink from "./ClauseLink";
import { api, type CheckResult, type Verdict } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { formatEvidenceValue } from "@/lib/format";

const VERDICT_CONFIG = {
  PASS: { icon: CheckCircle2, badge: "pass" as const, ring: "ring-emerald-200 dark:ring-emerald-900" },
  FAIL: { icon: XCircle, badge: "fail" as const, ring: "ring-rose-200 dark:ring-rose-900" },
  NOT_APPLICABLE: { icon: MinusCircle, badge: "neutral" as const, ring: "ring-slate-200 dark:ring-slate-800" },
};

const VERDICT_FILTERS: Array<{ label: string; value: Verdict | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Pass", value: "PASS" },
  { label: "Fail", value: "FAIL" },
];

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(results: CheckResult[]): string {
  const header = ["Rule", "Category", "Tier", "Verdict", "Clause", "Explanation"];
  const rows = results.map((r) => [
    r.rule_title,
    r.category,
    r.tier,
    r.verdict,
    `${r.citation.circular} Para ${r.citation.para}`,
    r.explanation,
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export default function Scorecard() {
  const { data, loading, error, refetch } = useApi(() => api.getReport());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<Verdict | "ALL">("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const categories = useMemo(
    () => Array.from(new Set((data?.results ?? []).map((r) => r.category))).sort(),
    [data]
  );
  const tiers = useMemo(() => Array.from(new Set((data?.results ?? []).map((r) => r.tier))).sort(), [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.results.filter((r) => {
      if (verdictFilter !== "ALL" && r.verdict !== verdictFilter) return false;
      if (tierFilter !== "ALL" && r.tier !== tierFilter) return false;
      if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;
      if (search.trim() && !r.rule_title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [data, verdictFilter, tierFilter, categoryFilter, search]);

  const categoryBreakdown = useMemo(() => {
    if (!data) return [];
    const byCategory = new Map<string, { category: string; PASS: number; FAIL: number }>();
    for (const r of data.results) {
      if (r.verdict === "NOT_APPLICABLE") continue;
      const entry = byCategory.get(r.category) ?? { category: r.category, PASS: 0, FAIL: 0 };
      entry[r.verdict as "PASS" | "FAIL"] += 1;
      byCategory.set(r.category, entry);
    }
    return Array.from(byCategory.values());
  }, [data]);

  const complianceScore = data && data.total_checked > 0 ? Math.round((data.passed / data.total_checked) * 100) : 0;

  function handleExport(format: "csv" | "json") {
    if (!data) return;
    const stamp = data.as_of_date;
    if (format === "csv") {
      downloadFile(`regcheck-scorecard-${stamp}.csv`, toCsv(filtered), "text/csv");
    } else {
      downloadFile(`regcheck-scorecard-${stamp}.json`, JSON.stringify(filtered, null, 2), "application/json");
    }
  }

  return (
    <div>
      <PageHeader
        title="Compliance Scorecard"
        subtitle="Every obligation, its verdict, and the exact clause that proves it."
        onRefresh={refetch}
      />

      {error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : loading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-56" />
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : (
        <>
          {/* Hero: compliance gauge + category breakdown */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardContent className="flex flex-col items-center p-6">
                <div className="relative h-40 w-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      innerRadius="72%"
                      outerRadius="100%"
                      data={[{ name: "score", value: complianceScore, fill: complianceScore >= 60 ? "#0d9488" : "#e11d48" }]}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                      <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "var(--color-slate-100)" }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{complianceScore}%</span>
                    <span className="text-[11px] text-slate-400">compliant</span>
                  </div>
                </div>
                <div className="mt-4 grid w-full grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{data.passed}</div>
                    <div className="text-[11px] text-slate-400">passed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{data.failed}</div>
                    <div className="text-[11px] text-slate-400">failed</div>
                  </div>
                </div>
                <div className="mt-4 w-full border-t border-slate-100 pt-3 text-center text-xs text-slate-400 dark:border-slate-800">
                  {data.broker_name} · as of {data.as_of_date}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardContent className="p-6">
                <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Pass/fail by category</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--color-slate-400)" />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={140}
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-slate-400)"
                    />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}
                    />
                    <Bar dataKey="PASS" stackId="v" fill="#10b981" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="FAIL" stackId="v" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Filter + search toolbar */}
          <Card className="mb-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {VERDICT_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setVerdictFilter(f.value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      verdictFilter === f.value
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="ALL">All tiers</option>
                {tiers.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <option value="ALL">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <div className="relative flex-1 min-w-[160px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search obligations…"
                  className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleExport("csv")}>
                  <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleExport("json")}>
                  <FileJson className="h-3.5 w-3.5" /> JSON
                </Button>
              </div>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center text-sm text-slate-400">
              <Download className="h-6 w-6 text-slate-300 dark:text-slate-700" />
              No obligations match these filters.
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((r, i) => (
                <ResultRow
                  key={r.rule_id}
                  result={r}
                  index={i}
                  expanded={expanded === r.rule_id}
                  onToggle={() => setExpanded(expanded === r.rule_id ? null : r.rule_id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
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
                        <div className="truncate text-xs font-medium tabular-nums text-slate-700 dark:text-slate-200">
                          {formatEvidenceValue(k, v)}
                        </div>
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
