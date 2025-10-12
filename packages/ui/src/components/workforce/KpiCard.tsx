import type { ReactElement, ReactNode } from "react";
import { useId } from "react";
import type { LucideIcon } from "lucide-react";

export interface WorkforceKpiCardProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

export function WorkforceKpiCard({
  icon: Icon,
  title,
  description,
  children
}: WorkforceKpiCardProps): ReactElement {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border-base bg-canvas-subtle/60 p-6"
    >
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="size-5 text-accent-primary" />
        <h3 className="text-lg font-semibold text-text-primary" id={headingId}>
          {title}
        </h3>
      </div>
      <p className="mt-2 text-sm text-text-muted">{description}</p>
      <div className="mt-4 space-y-3 text-sm text-text-primary">{children}</div>
    </section>
  );
}
