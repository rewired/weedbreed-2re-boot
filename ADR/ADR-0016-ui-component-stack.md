# ADR-0016 — UI Component Stack (Tailwind + shadcn/ui on Radix)

## Status
Accepted

## Context
The project already standardizes on Tailwind CSS for styling (see SEC §0.1). We need a component layer that:
- keeps full control of styles and themes in Tailwind,
- provides robust primitives for overlays/portals/focus management,
- avoids vendor lock by keeping component code in-repo,
- accelerates delivery with well-designed patterns (dialog, sheet, tabs, table, toast).

## Decision
Adopt **shadcn/ui**, which copies unstyled components into the repository and composes **Radix UI primitives**, with Tailwind as the single source of design tokens. Use **lucide-react** for icons, **Framer Motion** for micro-animations, and **Recharts** (optionally **Tremor** for dashboard presets) for charts.

## Consequences
- **Pros:** Strong a11y primitives, fast delivery of common patterns, full theming control via Tailwind, no runtime vendor lock (components live in the repo).
- **Neutral:** ARIA/a11y is not a primary gameplay driver but improves quality at low cost.
- **Cons:** Slightly higher initial setup (component generation/variants) compared to CSS-only.

## Alternatives Considered
- **Headless UI (Tailwind Labs):** Excellent headless primitives but requires more bespoke wiring for overlays/state; slower team velocity for common patterns.
- **daisyUI / Flowbite:** Faster out-of-the-box visuals but more opinionated styling and less granular control; potential drift from our Tailwind token system.

## Links
- SEC §0.1 Platform Baseline (Tailwind as styling choice)
- DD §1/§15 guardrails referencing UI boundaries
- AGENTS §1 platform stack
