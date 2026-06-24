import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A0E16",
        panel: "#111722",
        panel2: "#0D131E",
        grid: "#1C2738",
        edge: "#243348",
        haze: "#5B7FB0",
        text: "#C7D2E0",
        dim: "#7C8AA0",
        faint: "#48566B",
        signal: "#E8B931",
        crypto: "#E8B931",
        stock: "#5BA8FF",
        long: "#2DD4A7",
        short: "#FF5C6C",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 0 0 1px rgba(36,51,72,0.6)",
      },
    },
  },
  plugins: [],
};
export default config;
