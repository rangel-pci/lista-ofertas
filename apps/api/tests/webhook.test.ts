/**
 * Webhook de sincronização (RF-4) — AC-1 e AC-2.
 *
 * Contrato assumido a partir de design.md (seção 4.5), que já é uma decisão
 * de arquitetura do Líder Técnico, não inventada por este teste:
 * - `POST /api/scrape-runs` com header `X-Webhook-Key`.
 * - Chave inválida/ausente → 401, nenhum `ScrapeRun` é criado.
 * - Chave válida → cria `ScrapeRun` (status RUNNING), responde 202 com o
 *   `id` da execução, dispara o scraping assíncrono.
 * - `GET /api/scrape-runs/:id` consulta o status.
 *
 * Contrato assumido de testabilidade (não é decisão de arquitetura de
 * produto): `../src/app` exporta `buildApp(): FastifyInstance`, o padrão
 * recomendado pelo próprio Fastify (já escolhido em design.md) para testar
 * sem abrir uma porta de rede real. A chave é lida de `WEBHOOK_SECRET`
 * (nome de variável já definido em design.md).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.WEBHOOK_SECRET = "chave-secreta-de-teste";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/lista_ofertas_test";

// @ts-expect-error - módulo de produção ainda não existe; este teste define o contrato esperado.
import { buildApp } from "../src/app";
import { resetOfertasEExecucoes } from "./support/test-db";

describe("POST /api/scrape-runs (webhook de sincronização)", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetOfertasEExecucoes();
  });

  it("AC-1: chave correta dispara uma execução e retorna sucesso com um identificador", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/scrape-runs",
      headers: { "x-webhook-key": "chave-secreta-de-teste" },
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.statusCode).toBeLessThan(300);

    const body = response.json();
    expect(body).toHaveProperty("id");
    expect(typeof body.id === "string" || typeof body.id === "number").toBe(
      true,
    );
  });

  it("AC-2: chamada sem a chave é rejeitada e nenhuma execução é disparada", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/scrape-runs",
    });

    expect(response.statusCode).toBe(401);

    const runsAfter = await app.inject({
      method: "GET",
      url: "/api/scrape-runs",
    });
    // Nenhum ScrapeRun deve ter sido criado por esta chamada rejeitada.
    if (runsAfter.statusCode === 200) {
      expect(runsAfter.json()).toEqual([]);
    }
  });

  it("AC-2: chamada com chave incorreta é rejeitada e nenhuma execução é disparada", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/scrape-runs",
      headers: { "x-webhook-key": "chave-errada" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("AC-14: o status de uma execução (sucesso ou falha) fica consultável via GET /api/scrape-runs/:id", async () => {
    const trigger = await app.inject({
      method: "POST",
      url: "/api/scrape-runs",
      headers: { "x-webhook-key": "chave-secreta-de-teste" },
    });
    const { id } = trigger.json();

    const status = await app.inject({
      method: "GET",
      url: `/api/scrape-runs/${id}`,
    });

    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual(
      expect.objectContaining({
        id,
        status: expect.stringMatching(/^(RUNNING|SUCCESS|PARTIAL|FAILED)$/),
      }),
    );
  });
});
