import { ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-slate-50/60 dark:border-slate-800/70 dark:bg-slate-900/30">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div className="max-w-sm">
            <div className="flex items-center gap-2 font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-700 to-teal-600 text-white">
                <ShieldCheck className="h-4 w-4" />
              </span>
              RegCheck
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              A hackathon submission for SEBI's "Agentic Compliance — From Regulatory Text to
              Operational Action" problem statement. Intermediary: stock brokers. Corpus: SEBI's
              Master Circular for Stock Brokers.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div>
              <div className="mb-3 font-semibold text-slate-800 dark:text-slate-200">Product</div>
              <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                <li><a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white">Pipeline</a></li>
                <li><a href="#features" className="hover:text-slate-900 dark:hover:text-white">Features</a></li>
                <li><a href="/dashboard" className="hover:text-slate-900 dark:hover:text-white">Dashboard</a></li>
              </ul>
            </div>
            <div>
              <div className="mb-3 font-semibold text-slate-800 dark:text-slate-200">Data</div>
              <ul className="space-y-2 text-slate-500 dark:text-slate-400">
                <li>Synthetic broker profile</li>
                <li>9 real circular obligations</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400 dark:border-slate-800">
          Demo data is synthetic. A real pilot would connect to a broker's own back-office systems or
          SEBI's Innovation Sandbox (anonymized test data) — SEBI's public SCORES disclosures are
          aggregate statistics only, not per-broker records.
        </div>
      </div>
    </footer>
  );
}
