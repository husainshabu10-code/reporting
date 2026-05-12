import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#233244",
        mist: "#f5f7fb",
        panel: "#ffffff",
        line: "#e4e9f2"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(31, 48, 73, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
