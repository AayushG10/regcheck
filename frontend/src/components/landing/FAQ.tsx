import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./HowItWorks";

const FAQS = [
  {
    q: "How is this different from just asking a chatbot?",
    a: "A chatbot gives you a different, unverifiable answer every time you ask 'are we compliant?' RegCheck separates drafting from deciding: an LLM only ever proposes a structured rule, which a human approves once — after that, a plain deterministic Python engine runs it, the same way, every time, with the source clause as proof. That's what makes a verdict auditable instead of merely plausible.",
  },
  {
    q: "Is the broker data in this demo real?",
    a: "No — it's synthetic, by design. SEBI's public SCORES disclosures are aggregate statistics, not per-broker operational records, so there's no public dataset of a real broker's net worth, audit dates, or complaint ledger to build a demo from. A real pilot would connect to a broker's own back-office systems, or to SEBI's Innovation Sandbox using anonymized test data.",
  },
  {
    q: "What happens when SEBI publishes a new or amended circular?",
    a: "The Circular Monitor pipeline (monitor → diff → propose) detects which existing obligation a new notice amends, and an LLM drafts the parameter change with a confidence score and citation — the same discipline as the initial extraction. A human still approves before anything runs, which creates a new rule version and re-runs the scorecard automatically.",
  },
  {
    q: "Why does a human need to approve every rule — isn't that the manual work you're trying to remove?",
    a: "It's a one-time review per rule, not a recurring one. A compliance officer approves a rule once when it's drafted (or amended); after that, the deterministic engine runs it unattended on every subsequent check, including every amendment re-run, for free. Maker-checker also applies: whoever (or whatever) drafted a rule can't also approve it.",
  },
  {
    q: "Could this work for intermediaries other than stock brokers?",
    a: "Yes — the underlying schema (Rule, ClauseCitation, CheckResult, CheckRun) isn't stock-broker-specific. Extending to depositories, AMCs, RTAs, or investment advisers is a matter of swapping the corpus and the broker-data schema, not rebuilding the pipeline.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-28">
      <SectionHeading
        eyebrow="Questions"
        title="Answers to what people ask first"
        subtitle="The questions a judge, a compliance officer, or a skeptical engineer would ask before trusting this."
      />

      <div className="mt-14 space-y-3">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} className="card-surface overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
