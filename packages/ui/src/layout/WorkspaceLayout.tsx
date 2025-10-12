import type { ReactElement, ReactNode } from "react";
import { cn } from "@ui/lib/cn";

export interface WorkspaceLayoutProps {
  leftRail: ReactNode;
  main: ReactNode;
  footer?: ReactNode;
}

export function WorkspaceLayout({ leftRail, main, footer }: WorkspaceLayoutProps): ReactElement {
  return (
    <div className="min-h-screen bg-canvas-base text-text-primary">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row lg:gap-8">
        <aside
          aria-label="Primary navigation"
          className={cn(
            "flex w-full flex-col gap-6 rounded-2xl border border-border-base bg-canvas-raised/80 p-6 backdrop-blur",
            "lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72"
          )}
        >
          {leftRail}
        </aside>
        <main
          aria-label="Workspace content"
          className="flex w-full flex-1 flex-col gap-6 rounded-2xl border border-border-base bg-canvas-raised/60 p-6 backdrop-blur"
        >
          {main}
        </main>
      </div>
      {footer ? <footer className="px-6 pb-8 text-sm text-text-muted">{footer}</footer> : null}
    </div>
  );
}
