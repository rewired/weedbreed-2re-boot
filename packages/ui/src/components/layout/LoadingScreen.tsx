import type { ReactElement } from "react";
import { Loader2 } from "lucide-react";

export function LoadingScreen(): ReactElement {
    return (
        <div className="flex min-h-screen items-center justify-center bg-canvas-base text-text-muted">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="size-8 animate-spin text-accent-primary" />
                <p className="text-sm font-medium uppercase tracking-widest">Connecting to Facility...</p>
            </div>
        </div>
    );
}
