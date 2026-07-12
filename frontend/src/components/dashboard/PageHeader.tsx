import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PageHeader({
  title,
  subtitle,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  onRefresh?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-8 flex items-start justify-between gap-4"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {onRefresh && (
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      )}
    </motion.div>
  );
}
