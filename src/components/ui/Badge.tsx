import type { ReactNode } from "react";

export type BadgeVariant = "success" | "danger" | "warning" | "neutral" | "accent";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
  title?: string;
}

export function Badge({ children, variant = "neutral", className, title }: BadgeProps) {
  return (
    <span
      className={`badge badge--${variant}${className ? ` ${className}` : ""}`}
      title={title}
    >
      {children}
    </span>
  );
}
