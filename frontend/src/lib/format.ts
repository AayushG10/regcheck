/**
 * Formatting helpers for evidence values surfaced from the rule engine.
 *
 * The engine's evidence dicts are intentionally generic (see
 * backend/app/rules/handlers.py) — plain numbers and booleans, not
 * pre-formatted strings, so the deterministic core stays presentation-free.
 * This is where that raw data becomes something a compliance officer
 * actually wants to read: ₹3.6 Cr instead of 36000000, 72.0% instead of
 * 0.72, "5 days" instead of a bare 5.
 */

export function formatCurrencyINR(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

/** Formats a single evidence dict entry for display, inferring intent from
 * its key name (the same key names the deterministic handlers always use). */
export function formatEvidenceValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  const k = key.toLowerCase();

  if (typeof value === "number") {
    if ((k === "ratio" || k === "threshold") && value <= 1 && value >= -1) {
      return `${(value * 100).toFixed(1)}%`;
    }
    if (k === "numerator" || k === "denominator") {
      return formatCurrencyINR(value);
    }
    if (k.includes("days")) {
      return `${value} day${Math.abs(value) === 1 ? "" : "s"}`;
    }
    if (Number.isInteger(value) && Math.abs(value) >= 1000) {
      return value.toLocaleString("en-IN");
    }
    return String(value);
  }

  return String(value);
}
