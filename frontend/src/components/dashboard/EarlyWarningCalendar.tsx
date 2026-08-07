import { motion } from "framer-motion";
import { BellRing, CalendarClock, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import ClauseLink from "./ClauseLink";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";

export default function EarlyWarningCalendar() {
  const { data, loading, error, refetch } = useApi(() => api.getWarnings());

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
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <PartyPopper className="h-8 w-8 text-teal-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Nothing due in the next 21 days — all passing obligations have comfortable headroom.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((w, i) => (
            <motion.div
              key={w.rule_id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <Card className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
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
                <Badge variant={w.days_remaining <= 7 ? "fail" : "warning"}>
                  {w.days_remaining} day{w.days_remaining === 1 ? "" : "s"} left
                </Badge>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
