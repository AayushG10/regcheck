import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { BellRing, CalendarClock, PartyPopper, CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import ClauseLink from "./ClauseLink";
import { api, type EarlyWarning } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const DUE_SOON_CUTOFF = 21;
const TIMELINE_HORIZON_DAYS = 200;

export default function EarlyWarningCalendar() {
  const { data, loading, error, refetch } = useApi(() => api.getWarnings());

  const dueSoon = data?.filter((w) => w.days_remaining <= DUE_SOON_CUTOFF) ?? [];
  const furtherOut = data?.filter((w) => w.days_remaining > DUE_SOON_CUTOFF) ?? [];

  return (
    <div>
      <PageHeader
        title="Early-Warning Calendar"
        subtitle="Obligations that currently PASS but are approaching their next deadline — act before they become a FAIL."
        onRefresh={refetch}
      />

      {error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : loading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-32" />
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <PartyPopper className="h-8 w-8 text-teal-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nothing due in the compliance calendar horizon — all passing obligations have comfortable headroom.
          </p>
        </Card>
      ) : (
        <>
          <Timeline warnings={data} />

          {dueSoon.length > 0 && (
            <Section title="Due soon" subtitle={`within ${DUE_SOON_CUTOFF} days`}>
              {dueSoon.map((w, i) => <WarningRow key={w.rule_id} w={w} index={i} urgent />)}
            </Section>
          )}

          {furtherOut.length > 0 && (
            <Section title="Further out" subtitle="on the compliance calendar, not yet urgent">
              {furtherOut.map((w, i) => <WarningRow key={w.rule_id} w={w} index={i} />)}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        <span className="text-xs text-slate-400">{subtitle}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Timeline({ warnings }: { warnings: EarlyWarning[] }) {
  const markers = [0, 50, 100, 150, 200];

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <CalendarRange className="h-4 w-4 text-brand-600" /> {TIMELINE_HORIZON_DAYS}-day compliance calendar
        </div>

        <div className="relative mt-8 mb-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
          {warnings.map((w) => {
            const pct = Math.min(100, (w.days_remaining / TIMELINE_HORIZON_DAYS) * 100);
            const urgent = w.days_remaining <= DUE_SOON_CUTOFF;
            return (
              <motion.div
                key={w.rule_id}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                title={`${w.rule_title} — ${w.days_remaining} days`}
                className={cn(
                  "group absolute -top-2 h-6 w-6 -translate-x-1/2 cursor-default rounded-full border-2 border-white shadow-md dark:border-slate-900",
                  urgent ? "bg-amber-500" : "bg-teal-500"
                )}
                style={{ left: `${pct}%` }}
              >
                <div className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block dark:bg-slate-100 dark:text-slate-900">
                  {w.rule_title} · {w.days_remaining}d
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 flex justify-between text-[11px] text-slate-400">
          {markers.map((m) => (
            <span key={m}>{m === 0 ? "Today" : `+${m}d`}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WarningRow({ w, index, urgent }: { w: EarlyWarning; index: number; urgent?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            urgent
              ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
          )}
        >
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{w.rule_title}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <CalendarClock className="h-3 w-3" /> Due by {w.deadline_date}
            <span>·</span>
            <ClauseLink clauseId={w.clause_id} citation={w.citation} />
          </div>
        </div>
        <Badge variant={w.days_remaining <= 7 ? "fail" : urgent ? "warning" : "teal"}>
          {w.days_remaining} day{w.days_remaining === 1 ? "" : "s"} left
        </Badge>
      </Card>
    </motion.div>
  );
}
