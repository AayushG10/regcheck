import { motion } from "framer-motion";
import { Link2, Cpu, BellRing, ClipboardList, RefreshCcw, ShieldCheck } from "lucide-react";
import { SectionHeading } from "./HowItWorks";

const FEATURES = [
  {
    icon: Link2,
    title: "Every verdict cites its clause",
    desc: "PASS or FAIL, every result links straight back to the exact circular paragraph — no more 'trust me'.",
  },
  {
    icon: Cpu,
    title: "Deterministic, not hallucinated",
    desc: "The LLM only ever drafts a rule. A plain Python engine decides PASS/FAIL — auditable and re-runnable.",
  },
  {
    icon: BellRing,
    title: "Early-warning before you breach",
    desc: "See obligations approaching their deadline — 'VAPT due in 8 days' — before they become a FAIL.",
  },
  {
    icon: ClipboardList,
    title: "Failures become work items",
    desc: "Every FAIL turns into a remediation task with an owner, a fix, and a due date automatically.",
  },
  {
    icon: RefreshCcw,
    title: "Amendments re-run instantly",
    desc: "SEBI tightens a rule — you tighten one parameter and watch every affected verdict flip live.",
  },
  {
    icon: ShieldCheck,
    title: "Human-approved, always",
    desc: "Anything under 0.85 confidence is flagged for review — no rule runs unsupervised until approved.",
  },
];

export default function Features() {
  return (
    <section id="features" className="border-y border-slate-200/70 bg-slate-50/60 py-28 dark:border-slate-800/70 dark:bg-slate-900/30">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeading
          eyebrow="Capabilities"
          title="Built for auditability, not just automation"
          subtitle="Every design decision optimizes for one thing: a regulator or auditor should be able to trace any verdict back to source in seconds."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="card-surface group p-6 transition-shadow hover:shadow-[var(--shadow-soft-lg)]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-teal-50 text-brand-700 transition-transform group-hover:scale-110 dark:from-brand-900/30 dark:to-teal-900/30 dark:text-brand-400">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
