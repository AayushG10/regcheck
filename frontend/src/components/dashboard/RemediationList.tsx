import { motion } from "framer-motion";
import { User, CalendarDays, PartyPopper } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./PageHeader";
import ErrorCard from "./ErrorCard";
import ClauseLink from "./ClauseLink";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";

const PRIORITY_BADGE = { high: "fail", medium: "warning", low: "neutral" } as const;

export default function RemediationList() {
  const { data, loading, error, refetch } = useApi(() => api.getRemediation());

  return (
    <div>
      <PageHeader
        title="Remediation"
        subtitle="Every FAIL, turned into an owned work item with a fix and a due date."
        onRefresh={refetch}
      />

      {error ? (
        <ErrorCard message={error} onRetry={refetch} />
      ) : loading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : data.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <PartyPopper className="h-8 w-8 text-teal-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No open remediation tasks — every rule passes.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{task.rule_title}</span>
                      <Badge variant={PRIORITY_BADGE[task.priority]}>{task.priority} priority</Badge>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{task.fix}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {task.owner}</span>
                      <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Due {task.due_date}</span>
                      <ClauseLink clauseId={task.clause_id} citation={task.citation} />
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
