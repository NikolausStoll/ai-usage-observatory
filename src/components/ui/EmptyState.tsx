import type { ReactNode } from "react";

interface EmptyStateProps {
  children: ReactNode;
  inline?: boolean;
}

export function EmptyState({ children, inline }: EmptyStateProps) {
  return (
    <div className={`empty-state${inline ? " empty-state--inline" : ""}`}>
      {children}
    </div>
  );
}
