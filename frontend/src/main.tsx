import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/lib/theme";
import App from "./App.tsx";
import "@/styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
        <Toaster position="bottom-right" richColors closeButton />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
