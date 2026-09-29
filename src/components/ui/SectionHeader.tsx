import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, actions, className }: SectionHeaderProps) {
  return (
    <div className={`section-header${className ? ` ${className}` : ""}`}>
      <h2 className="section-title">{title}</h2>
      {actions ? <div className="cluster">{actions}</div> : null}
    </div>
  );
}
