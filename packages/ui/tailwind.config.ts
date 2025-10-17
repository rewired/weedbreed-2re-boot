import type { Config } from "tailwindcss";
import { foundationTheme } from "./src/design/tokens";

const fontFamily = {
  sans: [...foundationTheme.fontFamily.sans],
  mono: [...foundationTheme.fontFamily.mono]
};

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: foundationTheme.colors.canvas,
        accent: foundationTheme.colors.accent,
        border: foundationTheme.colors.border,
        text: foundationTheme.colors.text,
        surface: foundationTheme.colors.surface
      },
      fontFamily,
      borderRadius: foundationTheme.borderRadius,
      spacing: {
        rail: foundationTheme.spacing.rail
      }
    }
  },
  plugins: []
};

export default config;
