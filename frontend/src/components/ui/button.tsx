import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950",
  {
    variants: {
      variant: {
        default:
          "bg-brand-700 text-white shadow-[var(--shadow-soft)] hover:bg-brand-800 active:scale-[0.98]",
        secondary:
          "bg-white text-slate-900 border border-slate-200 shadow-sm hover:bg-slate-50 active:scale-[0.98] dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:hover:bg-slate-800",
        ghost: "hover:bg-slate-100 dark:hover:bg-slate-800",
        outline:
          "border border-slate-300 bg-transparent hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
        teal: "bg-teal-600 text-white shadow-[var(--shadow-soft)] hover:bg-teal-700 active:scale-[0.98]",
        link: "text-brand-700 underline-offset-4 hover:underline dark:text-brand-400",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-7 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
