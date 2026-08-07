import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-6 text-center dark:bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-700 to-teal-600 text-white shadow-[var(--shadow-soft-lg)]">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">404</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            No obligation matches this page
          </h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            The page you're looking for doesn't exist — unlike every obligation in RegCheck, this one
            didn't come with a citation.
          </p>
        </div>
        <Button asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </Button>
      </motion.div>
    </div>
  );
}
