import { defineConfig } from "vitest/config";

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
  },
});
