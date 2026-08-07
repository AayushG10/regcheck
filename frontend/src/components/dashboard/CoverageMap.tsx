import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Cpu, ClipboardCheck, Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";

const TIER_META = {
  auto: { label: "Auto-checkable", color: "#0d9488", icon: Cpu, desc: "Fully deterministic — the engine checks these against broker data with no human step." },
  evidence: { label: "Evidence-tracked", color: "#2563eb", icon: ClipboardCheck, desc: "Data-driven, but a human confirms the underlying evidence (e.g. a certificate is genuine)." },
  judgment: { label: "Human judgment", color: "#f59e0b", icon: Scale, desc: "Qualitative obligations that cannot be reduced to a deterministic data check." },
};

export default function CoverageMap() {
  const { data, loading, error, refetch } = useApi(() => api.getCoverage());

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
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
                        <Cell key={key} fill={TIER_META[key as keyof typeof TIER_META].color} stroke="none" />
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
      )}
    </div>
  );
}
