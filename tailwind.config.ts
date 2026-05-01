import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 24px 60px -24px rgba(15, 23, 42, 0.35)",
      },
      colors: {
        ink: "#0f172a",
        paper: "#f8fafc",
      },
    },
  },
  plugins: [],
};

export default config;