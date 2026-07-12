import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300",
        pass: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
        fail: "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
        warning: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
        neutral: "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        teal: "border-transparent bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
        outline: "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
