/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        serif: ["Fraunces", "ui-serif", "Georgia", "serif"],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "monospace",
        ],
      },
      colors: {
        bg: {
          DEFAULT: "#0a0a0a",
          surface: "#141414",
          subtle: "#1c1c1c",
        },
        line: {
          DEFAULT: "#222222",
          subtle: "#1a1a1a",
          strong: "#2e2e2e",
        },
        ink: {
          DEFAULT: "#fafafa",
          muted: "#a3a3a3",
          dim: "#737373",
        },
        gold: {
          DEFAULT: "#d4af37",
          soft: "#b08f2c",
        },
        yes: "#3fb950",
        no: "#f85149",
      },
      letterSpacing: {
        forum: ".18em",
      },
    },
  },
  plugins: [],
};
