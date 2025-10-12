import type { ReactElement } from "react";
import { dismissToast, useToastStore } from "@ui/state/toast";
import { cn } from "@ui/lib/cn";

function resolveVariantClasses(variant: "info" | "success" | "error"): string {
  switch (variant) {
    case "success":
      return "border-accent-primary/60 bg-accent-primary/10 text-accent-primary";
    case "error":
      return "border-destructive/60 bg-destructive/10 text-destructive";
    default:
      return "border-accent-muted/60 bg-canvas-raised text-text-primary";
  }
}

export function ToastViewport(): ReactElement | null {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-50 flex flex-col items-end justify-end gap-3 p-6"
      role="status"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto w-full max-w-sm rounded-lg border px-4 py-3 shadow-lg backdrop-blur",
            resolveVariantClasses(toast.variant)
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.description ? (
                <p className="mt-1 text-xs text-text-muted">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="text-xs font-medium text-text-muted hover:text-text-primary"
              onClick={() => {
                dismissToast(toast.id);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
