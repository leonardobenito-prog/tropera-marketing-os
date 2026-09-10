import type { Config } from "tailwindcss";

// Tokens tomados directo del prototipo (tropera-marketing-os.jsx) —
// mantener este archivo sincronizado si el design system cambia.
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        forest: "#55a085",
        copper: "#C8793A",
        bone: "#F7F5F0",
        success: "#3E8E5A",
        warning: "#D4A247",
        danger: "#C24B3F",
        ink: "#22262B",
        muted: "#7A7D74",
        line: "#E4E1D8",
      },
      fontFamily: {
        heading: ["'Chelsea Market'", "cursive"],
        display: ["Fraunces", "serif"],
        sans: ["Inter", "sans-serif"],
      },
      borderRadius: {
        card: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
