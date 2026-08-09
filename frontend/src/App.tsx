import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";

// Landing and Dashboard are the two top-level route bundles, and a visitor
// only ever needs one of them on first load — code-splitting here (plus the
// per-view splitting inside Dashboard.tsx) is what keeps the initial JS
// payload down instead of shipping recharts/framer-motion for every route
// whether or not that page is ever visited.
const Landing = lazy(() => import("@/pages/Landing"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 dark:border-slate-800" />
    </div>
  );
}

function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

function App() {
  const location = useLocation();
  // Key only on the top-level route so switching between landing/dashboard/404
  // fades, but navigating between dashboard tabs (all under /dashboard/*)
  // doesn't remount the whole shell on every click.
  const transitionKey = location.pathname.startsWith("/dashboard") ? "/dashboard" : location.pathname;

  return (
    <TooltipProvider delayDuration={150}>
      <Suspense fallback={<RouteFallback />}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={transitionKey}>
            <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
            <Route path="/dashboard/*" element={<Dashboard />} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </TooltipProvider>
  );
}

export default App;
