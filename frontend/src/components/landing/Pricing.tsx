import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "./HowItWorks";

const PLANS = [
  {
    name: "Starter",
    price: "₹15,000",
    period: "/month",
    description: "For a single-branch broker getting their first automated compliance checks.",
    features: ["Up to 15 auto-checkable rules", "Weekly scorecard runs", "Email early-warning alerts", "CSV/JSON export"],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "₹45,000",
    period: "/month",
    description: "For brokers who need the full pipeline, amendment loop, and audit trail.",
    features: [
      "Unlimited rules across the Master Circular",
      "Daily runs + full audit trail",
      "Agentic circular monitoring",
      "Amendment simulator & one-click apply",
      "Remediation task assignment",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For broker groups and depositories needing multi-entity rollout.",
    features: [
      "Multi-branch / multi-entity dashboards",
      "Back-office system connectors",
      "SSO, RBAC & maker-checker workflows",
      "Dedicated compliance-content updates",
      "SLA-backed support",
    ],
    cta: "Talk to us",
    highlighted: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="border-y border-slate-200/70 bg-slate-50/60 py-28 dark:border-slate-800/70 dark:bg-slate-900/30">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Illustrative pricing"
          title="Priced for what compliance automation is worth"
          subtitle="A sketch of how RegCheck would be packaged commercially — scaled to obligation volume and intermediary size, not per-seat."
        />

        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={
                plan.highlighted
                  ? "relative rounded-2xl border-2 border-brand-500 bg-white p-8 shadow-[var(--shadow-soft-lg)] dark:bg-slate-900"
                  : "card-surface p-8"
              }
            >
              {plan.highlighted && (
                <Badge variant="default" className="absolute -top-3 left-8">
                  Most popular
                </Badge>
              )}
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">{plan.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">{plan.price}</span>
                <span className="text-sm text-slate-400">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{plan.description}</p>

              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button variant={plan.highlighted ? "default" : "secondary"} className="mt-8 w-full">
                {plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Illustrative figures for this hackathon submission — not a live commercial offering.
        </p>
      </div>
    </section>
  );
}
