export const foundationTheme = {
  colors: {
    canvas: {
      base: "#0f172a",
      raised: "#111827",
      subtle: "#1f2937"
    },
    accent: {
      primary: "#16a34a",
      muted: "#bbf7d0"
    },
    border: {
      base: "#1f2937"
    },
    text: {
      primary: "#f9fafb",
      muted: "#9ca3af"
    }
  },
  fontFamily: {
    sans: ["'Inter'", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
    mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"]
  },
  borderRadius: {
    lg: "0.75rem",
    xl: "1rem"
  },
  spacing: {
    rail: "18rem"
  }
} as const;

export const workspaceCopy = {
  appName: "Weed Breed",
  leftRail: {
    header: "Operations",
    placeholder: "Navigate across company overview, structures, workforce, and strains.",
    collapseToggle: {
      collapse: "Collapse navigation",
      expand: "Expand navigation"
    },
    sections: {
      company: {
        label: "Company",
        description: "Overview, balance, and tick cadence"
      },
      structures: {
        label: "Structures",
        description: "Facilities, rooms, and grow zones"
      },
      hr: {
        label: "HR",
        description: "Workforce scheduling and KPIs"
      },
      strains: {
        label: "Strains",
        description: "Genetics library and cultivation notes"
      }
    }
  },
  main: {
    heading: "Workspace",
    body: "This surface will render telemetry dashboards, read-model summaries, and workflow tools."
  },
  simControlBar: {
    label: "Simulation controls",
    play: "Play",
    pause: "Pause",
    step: "Step",
    speedsLabel: "Speed",
    tickClockLabel: "Sim time",
    balanceLabel: "Balance",
    balanceDeltaLabel: "Δ per hour",
    localeLabels: {
      "en-US": {
        day: "Day",
        deltaSuffix: "per hour"
      },
      "de-DE": {
        day: "Tag",
        deltaSuffix: "pro Stunde"
      }
    }
  }
} as const;
