"use client";

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "green"
  | "yellow"
  | "red"
  | "blue"
  | "violet"
  | "rose"
  | "gray"
  | "amber";

const variants: Record<BadgeVariant, string> = {
  green:  "bg-emerald-100 text-emerald-700 border-emerald-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  red:    "bg-red-100 text-red-700 border-red-200",
  blue:   "bg-blue-100 text-blue-700 border-blue-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  rose:   "bg-rose-100 text-rose-700 border-rose-200",
  gray:   "bg-gray-100 text-gray-600 border-gray-200",
  amber:  "bg-amber-100 text-amber-700 border-amber-200",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "gray", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
