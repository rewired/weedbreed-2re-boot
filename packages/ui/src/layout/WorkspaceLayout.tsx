import type { ReactElement, ReactNode } from "react";
import { ToastViewport } from "@ui/components/layout/ToastViewport";
import { cn } from "@ui/lib/cn";

export interface WorkspaceLayoutProps {
  leftRail: ReactNode;
  main: ReactNode;
  simControlBar: ReactNode;
  footer?: ReactNode;
}

export function WorkspaceLayout({ leftRail, main, simControlBar, footer }: WorkspaceLayoutProps): ReactElement {
  return (
    <>
      <div className="min-h-screen bg-canvas-base text-text-primary">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:gap-8 lg:px-6 lg:py-8">
          <aside
            aria-label="Primary navigation"
            className={cn(
              "flex w-full flex-col gap-6 rounded-2xl border border-border-base bg-canvas-raised/80 p-6 backdrop-blur",
              "lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-72"
            )}
          >
            {leftRail}
          </aside>
          <div className="flex w-full flex-1 flex-col gap-4 lg:gap-6">
            <div className="order-2 lg:order-1">{simControlBar}</div>
            <main
              aria-label="Workspace content"
              className="order-1 flex min-h-[28rem] flex-1 flex-col gap-6 rounded-2xl border border-border-base bg-canvas-raised/60 p-6 backdrop-blur lg:order-2"
            >
              {main}
            </main>
          </div>
        </div>
        {footer ? <footer className="px-6 pb-8 text-sm text-text-muted">{footer}</footer> : null}
      </div>
      <ToastViewport />
    </>
  );
}
