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
        primary: "#a03964",
        secondary: "#006879",
        tertiary: "#206963",
        background: "#fdf8f9",
        surface: "#fdf8f9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f7f2f3",
        "surface-container": "#f1edee",
        "surface-container-high": "#ece7e8",
        "surface-container-highest": "#e6e1e2",
        "surface-variant": "#e6e1e2",
        "primary-container": "#ffd9e3",
        "primary-fixed": "#ffd9e3",
        "primary-fixed-dim": "#ffb0ca",
        "secondary-container": "#aaedff",
        "secondary-fixed": "#aaedff",
        "secondary-fixed-dim": "#85d2e6",
        "tertiary-container": "#abefe7",
        "tertiary-fixed": "#abefe7",
        "tertiary-fixed-dim": "#8fd3cb",
        "on-surface": "#1c1b1c",
        "on-surface-variant": "#5a3f48",
        outline: "#8e6f78",
        "outline-variant": "#e2bdc7",
        "on-primary-container": "#81204c",
        "on-secondary-container": "#004e5c",
        "on-tertiary-container": "#00504b",
      },
      borderRadius: {
        lg: "2rem",
        xl: "3rem",
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        bubbly: "0 25px 50px -12px rgba(160, 57, 100, 0.15)",
        ambient: "0 20px 60px -15px rgba(160, 57, 100, 0.14)",
      },
      backgroundImage: {
        "hero-glow":
          "radial-gradient(circle at top left, rgba(255, 217, 227, 0.95), transparent 35%), radial-gradient(circle at bottom right, rgba(170, 237, 255, 0.8), transparent 35%)",
        "cta-gradient": "linear-gradient(135deg, #a03964 0%, #d6628d 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
