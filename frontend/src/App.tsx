import { Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";

function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
      </Routes>
    </TooltipProvider>
  );
}

export default App;
