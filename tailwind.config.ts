import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-text)",
        mist: "var(--color-bg)",
        panel: "var(--color-card)",
        line: "var(--color-border)"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(11, 79, 58, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
