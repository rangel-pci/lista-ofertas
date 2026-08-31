import type { Config } from "tailwindcss";

/**
 * Mobile first (RF-5): o layout base é o de tela pequena e os breakpoints só
 * acrescentam colunas/espaçamento a partir de 480px.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        xs: "480px",
      },
      colors: {
        marca: {
          DEFAULT: "#0f766e",
          escuro: "#115e59",
          claro: "#ccfbf1",
        },
      },
    },
  },
  plugins: [],
};

export default config;
