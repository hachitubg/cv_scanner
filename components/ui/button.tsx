import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-cta-gradient text-white shadow-bubbly hover:-translate-y-0.5 hover:shadow-ambient",
  secondary:
    "bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed",
  ghost:
    "border border-white/80 bg-surface-container-low text-on-surface shadow-sm hover:bg-white hover:shadow-[0_10px_22px_rgba(15,23,42,0.08)]",
  danger: "bg-rose-500 text-white hover:bg-rose-600",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-extrabold transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
