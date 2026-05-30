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
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "sans-serif"]
      },
      boxShadow: {
        soft: "0 10px 24px rgba(31, 41, 51, 0.075), 0 2px 7px rgba(31, 41, 51, 0.045), inset 0 1px 0 rgba(255, 255, 255, 0.78)"
      }
    }
  },
  plugins: []
};

export default config;
