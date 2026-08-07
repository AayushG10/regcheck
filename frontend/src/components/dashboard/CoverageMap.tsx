import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Cpu, ClipboardCheck, Scale, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import ClauseLink from "./ClauseLink";
import { api, type Tier } from "@/lib/api";
import { useApi } from "@/lib/hooks";

const TIER_META: Record<Tier, { label: string; color: string; icon: typeof Cpu; desc: string }> = {
  auto: { label: "Auto-checkable", color: "#0d9488", icon: Cpu, desc: "Fully deterministic — the engine checks these against broker data with no human step." },
  evidence: { label: "Evidence-tracked", color: "#2563eb", icon: ClipboardCheck, desc: "Data-driven, but a human confirms the underlying evidence (e.g. a certificate is genuine)." },
  judgment: { label: "Human judgment", color: "#f59e0b", icon: Scale, desc: "Qualitative obligations that cannot be reduced to a deterministic data check." },
};

export default function CoverageMap() {
  const { data, loading, error, refetch } = useApi(() => api.getCoverage());
  const { data: rules } = useApi(() => api.getRules());

  const categoryBreakdown = useMemo(() => {
    if (!rules) return [];
    const byCategory = new Map<string, { category: string; auto: number; evidence: number; judgment: number }>();
    for (const r of rules) {
      const entry = byCategory.get(r.category) ?? { category: r.category, auto: 0, evidence: 0, judgment: 0 };
      entry[r.tier] += 1;
      byCategory.set(r.category, entry);
    }
    return Array.from(byCategory.values()).sort((a, b) => a.category.localeCompare(b.category));
  }, [rules]);

  const judgmentRules = useMemo(() => (rules ?? []).filter((r) => r.tier === "judgment"), [rules]);

  return (
    <div>
      <PageHeader
        title="Coverage Map"
        subtitle="How much of the Master Circular's obligations can RegCheck verify without a human in the loop?"
        onRefresh={refetch}
      />

      {error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : loading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardContent className="flex flex-col items-center p-8">
                <div className="relative h-56 w-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Auto", value: data.auto, key: "auto" },
                          { name: "Evidence", value: data.evidence, key: "evidence" },
                          { name: "Judgment", value: data.judgment, key: "judgment" },
                        ]}
                        dataKey="value"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={3}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {["auto", "evidence", "judgment"].map((key) => (
                          <Cell key={key} fill={TIER_META[key as Tier].color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">{data.coverage_pct}%</span>
                    <span className="text-xs text-slate-400">auto coverage</span>
                  </div>
                </div>
                <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  {data.total} obligations extracted from the corpus
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:col-span-3">
              {(["auto", "evidence", "judgment"] as const).map((tier) => {
                const meta = TIER_META[tier];
                const count = data[tier];
                const pct = data.total ? Math.round((count / data.total) * 100) : 0;
                return (
                  <Card key={tier} className="p-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
                      >
                        <meta.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{meta.label}</span>
                          <span className="text-sm font-bold" style={{ color: meta.color }}>
                            {count} <span className="text-xs font-normal text-slate-400">({pct}%)</span>
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: meta.color }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{meta.desc}</p>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Per-category breakdown table */}
          {categoryBreakdown.length > 0 && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Coverage by category</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-800">
                        <th className="pb-2 font-medium">Category</th>
                        <th className="pb-2 font-medium">Auto</th>
                        <th className="pb-2 font-medium">Evidence</th>
                        <th className="pb-2 font-medium">Judgment</th>
                        <th className="pb-2 font-medium">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryBreakdown.map((c) => {
                        const total = c.auto + c.evidence + c.judgment;
                        const pct = total ? Math.round((c.auto / total) * 100) : 0;
                        return (
                          <tr key={c.category} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                            <td className="py-2.5 font-medium text-slate-700 dark:text-slate-200">{c.category}</td>
                            <td className="py-2.5 text-teal-600 dark:text-teal-400">{c.auto || "—"}</td>
                            <td className="py-2.5 text-blue-600 dark:text-blue-400">{c.evidence || "—"}</td>
                            <td className="py-2.5 text-amber-600 dark:text-amber-400">{c.judgment || "—"}</td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-slate-400">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Why judgment-tier obligations can't be automated */}
          {judgmentRules.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <HelpCircle className="h-4 w-4 text-amber-500" /> Why these can't be automated
                </div>
                <div className="space-y-3">
                  {judgmentRules.map((r) => (
                    <div key={r.id} className="rounded-xl bg-amber-50/60 p-4 dark:bg-amber-900/10">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.title}</span>
                        <Badge variant="warning">judgment</Badge>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {r.description}
                      </p>
                      <div className="mt-2">
                        <ClauseLink clauseId={r.clause_id} citation={r.citation} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-relaxed text-slate-400">
                  RegCheck reports these honestly as requiring a human's judgment rather than forcing a
                  deterministic rule onto something inherently qualitative — that's what makes the {data.coverage_pct}%
                  auto-coverage figure trustworthy instead of an overclaim.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
