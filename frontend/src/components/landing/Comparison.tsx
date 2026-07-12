import { Check, X, MessageSquare, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { SectionHeading } from "./HowItWorks";

const ROWS = [
  { label: "Answers change every time you ask", chatbot: true, regcheck: false },
  { label: "Cites the exact clause as proof", chatbot: false, regcheck: true },
  { label: "Deterministic PASS/FAIL verdict", chatbot: false, regcheck: true },
  { label: "Re-runs automatically on data change", chatbot: false, regcheck: true },
  { label: "Tracks deadlines & sends warnings", chatbot: false, regcheck: true },
  { label: "Produces an audit trail a regulator can trust", chatbot: false, regcheck: true },
  { label: "Turns failures into owned work items", chatbot: false, regcheck: true },
];

export default function Comparison() {
  return (
    <section id="comparison" className="mx-auto max-w-5xl px-6 py-28">
      <SectionHeading
        eyebrow="Why not just ask a chatbot?"
        title="A chatbot answers. RegCheck proves."
        subtitle="Asking an LLM 'are we compliant?' gives you a different, unverifiable answer every time. RegCheck gives you the same, cited, re-runnable verdict — every time."
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="card-surface mt-14 overflow-hidden"
      >
        <div className="grid grid-cols-3 border-b border-slate-200 text-sm font-semibold dark:border-slate-800">
          <div className="p-4 text-slate-400">Capability</div>
          <div className="flex items-center gap-2 border-l border-slate-200 p-4 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <MessageSquare className="h-4 w-4" /> Generic chatbot
          </div>
          <div className="flex items-center gap-2 border-l border-slate-200 bg-brand-50/60 p-4 text-brand-800 dark:border-slate-800 dark:bg-brand-900/20 dark:text-brand-300">
            <ShieldCheck className="h-4 w-4" /> RegCheck
          </div>
        </div>
        {ROWS.map((row, i) => (
          <div
            key={row.label}
            className={`grid grid-cols-3 text-sm ${i !== ROWS.length - 1 ? "border-b border-slate-100 dark:border-slate-800/60" : ""}`}
          >
            <div className="p-4 text-slate-700 dark:text-slate-300">{row.label}</div>
            <div className="flex items-center justify-center border-l border-slate-200 p-4 dark:border-slate-800">
              {row.chatbot ? <Check className="h-4 w-4 text-slate-400" /> : <X className="h-4 w-4 text-rose-400" />}
            </div>
            <div className="flex items-center justify-center border-l border-slate-200 bg-brand-50/40 p-4 dark:border-slate-800 dark:bg-brand-900/10">
              {row.regcheck ? <Check className="h-4 w-4 text-teal-600" /> : <X className="h-4 w-4 text-rose-400" />}
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
