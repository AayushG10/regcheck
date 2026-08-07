import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, CheckCircle2, XCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-20 pb-28">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--color-brand-100) 70%, white) 0%, transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <Badge variant="teal" className="mb-6">
            <Sparkles className="h-3 w-3" /> Built for SEBI's Agentic Compliance Challenge
          </Badge>

          <h1 className="mx-auto text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.6rem] dark:text-white">
            Turn SEBI circulars into{" "}
            <span className="bg-gradient-to-r from-brand-700 to-teal-600 bg-clip-text text-transparent">
              automatic compliance checks
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            RegCheck reads SEBI's Master Circular for Stock Brokers, extracts each obligation as a
            structured rule, and runs it against your broker data — every PASS or FAIL cites the exact
            clause. No more manually re-reading circulars every time a rule changes.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/dashboard">
                Launch Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-teal-600" /> Deterministic engine
            </div>
            <div className="flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-teal-600" /> Every verdict cites its clause
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="relative mt-16"
        >
          <HeroScreenshot />
        </motion.div>
      </div>
    </section>
  );
}

function HeroScreenshot() {
  const { data: coverage } = useApi(() => api.getCoverage());

  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Browser chrome frame around a real dashboard screenshot — this is the actual product, not a mockup */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-soft-lg)] dark:border-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-left text-xs text-slate-400 dark:bg-slate-800">
            regcheck.app/dashboard
          </div>
        </div>
        <img
          src="/screenshots/dashboard-scorecard.png"
          alt="RegCheck compliance scorecard dashboard showing a compliance gauge, pass/fail by category, and the list of checked obligations"
          className="w-full"
          width={1440}
          height={900}
        />
      </div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="card-surface absolute -left-6 -top-6 z-20 hidden w-56 p-4 sm:block"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Net Worth Ratio</span>
          <Badge variant="fail">
            <XCircle className="h-3 w-3" /> FAIL
          </Badge>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-full w-[72%] rounded-full bg-rose-500" />
        </div>
        <div className="mt-1.5 text-[11px] text-slate-400">72% of ₹5.0Cr required (need ≥75%)</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="card-surface absolute -right-4 -bottom-5 z-20 flex items-center gap-2 px-3 py-2 sm:-right-8"
      >
        <div className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {coverage ? `${coverage.coverage_pct}% coverage` : "Live coverage"}
        </span>
      </motion.div>

      <div className="absolute inset-0 -z-10 translate-y-8 scale-95 rounded-2xl bg-gradient-to-tr from-brand-200/40 to-teal-200/40 blur-3xl dark:from-brand-900/30 dark:to-teal-900/30" />
    </div>
  );
}
