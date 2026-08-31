import { defineConfig } from "vitest/config";

import { TEST_DATABASE_URL } from "../../scripts/test-database-url.mjs";

export default defineConfig({
  test: {
    name: "api",
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Testes de integração usam um Postgres real de teste (ver tests/README.md)
    // e por isso rodam em série para evitar corrida em dados compartilhados.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    // O destino é fixado aqui para que um DATABASE_URL herdado do ambiente
    // (de outro projeto na mesma máquina) nunca seja migrado nem limpo por
    // esta suíte. Sobreponível de forma explícita por TEST_DATABASE_URL.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
  },
});
