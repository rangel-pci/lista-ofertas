import { defineWorkspace } from "vitest/config";

// Cada pacote/app com testes tem seu próprio vitest.config.ts. Este arquivo
// só agrega os projetos para permitir `npx vitest run` a partir da raiz.
export default defineWorkspace([
  "packages/scraping/vitest.config.ts",
  "apps/api/vitest.config.ts",
]);
