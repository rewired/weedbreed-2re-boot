import type { ReactElement } from "react";
import { LeftRail } from "@ui/layout/LeftRail";
import { MainPlaceholder } from "@ui/layout/MainPlaceholder";
import { WorkspaceLayout } from "@ui/layout/WorkspaceLayout";

function App(): ReactElement {
  return (
    <WorkspaceLayout
      leftRail={<LeftRail />}
      main={<MainPlaceholder />}
      footer={<p className="text-xs">Built with Node.js 22 · Deterministic engine scaffold (SEC v0.2.1)</p>}
    />
  );
}

export default App;
