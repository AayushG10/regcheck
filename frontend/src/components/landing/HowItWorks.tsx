import { motion } from "framer-motion";
import { Download, Sparkles, SplitSquareVertical, Cpu, FileCheck2 } from "lucide-react";

const STAGES = [
  { icon: Download, title: "Ingest", desc: "Pull SEBI circular clause text into the corpus." },
  { icon: Sparkles, title: "Extract", desc: "LLM drafts a structured rule + confidence score, cites the clause." },
  { icon: SplitSquareVertical, title: "Triage", desc: "Sort into auto / evidence / judgment tiers, compute coverage %." },
  { icon: Cpu, title: "Check & Report", desc: "Deterministic engine runs auto rules — PASS/FAIL with proof." },
  { icon: FileCheck2, title: "Act", desc: "Warnings, remediation tasks, and amendment re-runs — automatically." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-6 py-28">
      <SectionHeading
        eyebrow="The pipeline"
        title="From clause text to executable verdict"
        subtitle="Five stages turn unstructured regulatory language into a re-runnable, auditable check — with a human approving every rule before it ever executes."
      />

      <div className="relative mt-16 grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent md:block dark:via-slate-700" />
        {STAGES.map((stage, i) => (
          <motion.div
            key={stage.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="relative flex flex-col items-center text-center"
          >
            <div className="relative z-10 mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-[var(--shadow-soft)] dark:border-slate-800 dark:bg-slate-900">
              <stage.icon className="h-6 w-6 text-brand-700 dark:text-brand-400" />
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-[10px] font-bold text-white">
                {i + 1}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{stage.title}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{stage.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
        {title}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
  );
}
