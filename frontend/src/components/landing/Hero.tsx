import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, Sparkles, CheckCircle2, XCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <Badge variant="teal" className="mb-6">
            <Sparkles className="h-3 w-3" /> Built for SEBI's Agentic Compliance Challenge
          </Badge>

          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem] dark:text-white">
            Turn SEBI circulars into{" "}
            <span className="bg-gradient-to-r from-brand-700 to-teal-600 bg-clip-text text-transparent">
              automatic compliance checks
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            RegCheck reads SEBI's Master Circular for Stock Brokers, extracts each obligation as a
            structured rule, and runs it against your broker data — every PASS or FAIL cites the exact
            clause. No more manually re-reading circulars every time a rule changes.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link to="/dashboard">
                Launch Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <div className="mt-10 flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-teal-600" /> Deterministic engine
            </div>
            <div className="flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-teal-600" /> Every verdict cites its clause
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          className="relative"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto max-w-md">
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="card-surface relative z-10 p-5"
      >
        <div className="mb-4 flex items-center gap-2 text-xs font-medium text-slate-400">
          <FileText className="h-3.5 w-3.5" /> SEBI Master Circular · Para 18.5.5.8-9
        </div>
        <p className="mb-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          "Qualified Stock Brokers shall conduct VAPT of their applications and infrastructure at
          least once every six months..."
        </p>
        <div className="mb-4 flex items-center justify-center">
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="mb-1 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div>
            <div className="text-sm font-semibold">VAPT Half-Yearly Check</div>
            <div className="text-xs text-slate-400">confidence 0.96 · auto tier</div>
          </div>
          <Badge variant="pass">
            <CheckCircle2 className="h-3 w-3" /> PASS
          </Badge>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        className="card-surface absolute -bottom-8 -left-10 z-20 w-56 p-4"
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
        className="card-surface absolute -right-8 -top-6 z-20 flex items-center gap-2 px-3 py-2"
      >
        <div className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">70% coverage</span>
      </motion.div>

      <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-brand-200/40 to-teal-200/40 blur-3xl dark:from-brand-900/30 dark:to-teal-900/30" />
    </div>
  );
}
