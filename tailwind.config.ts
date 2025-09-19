import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx,js,jsx}",
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
    "./lib/**/*.{ts,tsx,js,jsx}",
    "./src/**/*.{ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        "cl-bg": "#070c11",
        "cl-panel": "#0e1520",
        "cl-border": "#14202e",
        "cl-muted": "#233041",
        "cl-cyan": "#22d3ee",
        "cl-emerald": "#34d399",
      },
      boxShadow: {
        "cl-card": "0 8px 32px rgba(15,23,32,0.45)",
      },
    },
  },
  safelist: [
    { pattern: /(bg|text|border)-(cyan|emerald|rose|amber|slate)-(100|200|300|400|500|600|700)/ },
    { pattern: /(shadow|ring)-(cyan|emerald|rose|amber)-(200|300|400)/ },
    { pattern: /(bg|text|border)-(emerald|cyan|rose|amber|sky)-(100|200|300|400|500)/ },
    { pattern: /bg-cl-.+/ },
    { pattern: /text-cl-.+/ },
  ],
  plugins: [forms],
};

export default config;
