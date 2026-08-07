import type { ReactNode } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import NotFound from "@/pages/NotFound";

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
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={transitionKey}>
          <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
          <Route path="/dashboard/*" element={<Dashboard />} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    </TooltipProvider>
  );
}

export default App;
