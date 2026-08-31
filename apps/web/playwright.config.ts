import { defineConfig, devices } from "@playwright/test";

/**
 * Estes testes E2E assumem o frontend (`apps/web`) e a API (`apps/api`,
 * com banco de dados e ao menos uma execução de scraping bem-sucedida)
 * já em execução. Ver `tests/README.md` para o passo a passo de setup.
 * Não usamos `webServer` aqui porque a stack completa (API + Postgres)
 * precisa estar de pé antes do frontend, e essa orquestração é
 * responsabilidade de quem roda os testes (dev local ou CI), não deste
 * arquivo de configuração de teste.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: process.env.WEB_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-375",
      use: { ...devices["iPhone SE"], viewport: { width: 375, height: 667 } },
    },
    {
      name: "mobile-480",
      use: { viewport: { width: 480, height: 800 } },
    },
    {
      name: "desktop-1280",
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
});
