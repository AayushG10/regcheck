import { motion } from "framer-motion";
import { SectionHeading } from "./HowItWorks";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function ROI() {
  const { data: coverage } = useApi(() => api.getCoverage());

  // Coverage % and obligation count are fetched live from /api/coverage rather
  // than hardcoded, so this section never silently drifts from what the
  // dashboard actually computes.
  const stats = [
    {
      value: coverage ? `${coverage.coverage_pct}%` : "—",
      label: "of obligations fully auto-checkable",
      detail: "computed live from the current rule set",
    },
    { value: "< 1 min", label: "to re-verify after an amendment", detail: "vs. re-reading the circular manually" },
    {
      value: coverage ? String(coverage.total) : "—",
      label: "real obligations, one scorecard",
      detail: "each clickable to its SEBI paragraph",
    },
    { value: "0", label: "unaudited verdicts", detail: "the LLM drafts, the engine decides" },
  ];

  return (
    <section id="roi" className="mx-auto max-w-7xl px-6 py-28">
      <SectionHeading
        eyebrow="Impact"
        title="Compliance work that used to take days, in minutes"
        subtitle="Smaller intermediaries especially lose hours per cycle manually cross-checking circulars against internal records. RegCheck collapses that into a repeatable run."
      />

      <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="card-surface p-7 text-center"
          >
            <div className="bg-gradient-to-br from-brand-700 to-teal-600 bg-clip-text text-4xl font-bold text-transparent">
              {s.value}
            </div>
            <div className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">{s.label}</div>
            <div className="mt-1 text-xs text-slate-400">{s.detail}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
