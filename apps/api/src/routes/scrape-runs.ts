import { createHash, timingSafeEqual } from "node:crypto";

import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { prisma } from "../db.js";
import { temScraperRegistrado } from "../scrapers/registry.js";
import { dispararScrapeRunEmBackground } from "../scrape-runner.js";

const HEADER_CHAVE = "x-webhook-key";

/**
 * Comparação em tempo constante da chave do webhook (RF-4).
 *
 * O digest é comparado em vez das strings cruas porque `timingSafeEqual` exige
 * buffers do mesmo tamanho, e o próprio tamanho da chave não deve vazar.
 */
function chaveDoWebhookEhValida(chaveRecebida: string | undefined): boolean {
  const chaveEsperada = process.env.WEBHOOK_SECRET;
  if (!chaveEsperada || !chaveRecebida) return false;

  const recebida = createHash("sha256").update(chaveRecebida).digest();
  const esperada = createHash("sha256").update(chaveEsperada).digest();

  return timingSafeEqual(recebida, esperada);
}

export const scrapeRunsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post<{ Body?: { mercado?: string }; Querystring: { mercado?: string } }>(
    "/api/scrape-runs",
    async (request, reply) => {
      const chaveRecebida = request.headers[HEADER_CHAVE];
      const chave = Array.isArray(chaveRecebida) ? chaveRecebida[0] : chaveRecebida;

      if (!chaveDoWebhookEhValida(chave)) {
        if (!process.env.WEBHOOK_SECRET) {
          app.log.error(
            "WEBHOOK_SECRET não está configurado: nenhuma chamada ao webhook pode ser autorizada",
          );
        }
        // Nenhum ScrapeRun é criado antes desta verificação passar (AC-2).
        return reply.code(401).send({
          error: "Unauthorized",
          message: "Chave de webhook ausente ou inválida.",
        });
      }

      const slugSolicitado = request.body?.mercado ?? request.query.mercado;

      const mercados = await prisma.mercado.findMany({
        where: slugSolicitado ? { slug: slugSolicitado } : { ativo: true },
        orderBy: { createdAt: "asc" },
      });

      const elegiveis = mercados.filter((mercado) => temScraperRegistrado(mercado.slug));

      if (elegiveis.length === 0) {
        return reply.code(422).send({
          error: "Unprocessable Entity",
          message: slugSolicitado
            ? `Mercado "${slugSolicitado}" não existe, está inativo ou não tem scraper registrado.`
            : "Nenhum mercado ativo com scraper registrado.",
        });
      }

      const execucoes = [];
      for (const mercado of elegiveis) {
        const scrapeRun = await prisma.scrapeRun.create({
          data: { mercadoId: mercado.id, status: "RUNNING" },
        });

        dispararScrapeRunEmBackground(prisma, {
          mercado: { id: mercado.id, slug: mercado.slug, urlBase: mercado.urlBase },
          scrapeRunId: scrapeRun.id,
          logger: app.log,
        });

        execucoes.push({
          id: scrapeRun.id,
          mercado: mercado.slug,
          status: scrapeRun.status,
          startedAt: scrapeRun.startedAt.toISOString(),
        });
      }

      // `id` é o identificador da execução disparada (AC-1). Quando mais de um
      // mercado é elegível, `runs` traz todas; `id` aponta para a primeira.
      return reply.code(202).send({ id: execucoes[0].id, runs: execucoes });
    },
  );

  app.get<{ Querystring: { mercado?: string; limite?: number } }>(
    "/api/scrape-runs",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            mercado: { type: "string" },
            limite: { type: "integer", minimum: 1, maximum: 200 },
          },
        },
      },
    },
    async (request) => {
      const execucoes = await prisma.scrapeRun.findMany({
        where: request.query.mercado ? { mercado: { slug: request.query.mercado } } : {},
        orderBy: { startedAt: "desc" },
        take: request.query.limite ?? 50,
        include: { mercado: { select: { slug: true, nome: true } } },
      });

      return execucoes.map(paraRespostaDeExecucao);
    },
  );

  app.get<{ Params: { id: string } }>("/api/scrape-runs/:id", async (request, reply) => {
    const execucao = await prisma.scrapeRun.findUnique({
      where: { id: request.params.id },
      include: { mercado: { select: { slug: true, nome: true } } },
    });

    if (!execucao) {
      return reply.code(404).send({
        error: "Not Found",
        message: `Execução de scraping "${request.params.id}" não encontrada.`,
      });
    }

    return paraRespostaDeExecucao(execucao);
  });
};

type ExecucaoComMercado = {
  id: string;
  mercadoId: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
  stats: unknown;
  mercado: { slug: string; nome: string };
};

function paraRespostaDeExecucao(execucao: ExecucaoComMercado) {
  return {
    id: execucao.id,
    status: execucao.status,
    mercadoId: execucao.mercadoId,
    mercado: execucao.mercado.slug,
    mercadoNome: execucao.mercado.nome,
    startedAt: execucao.startedAt.toISOString(),
    finishedAt: execucao.finishedAt?.toISOString() ?? null,
    errorMessage: execucao.errorMessage,
    stats: execucao.stats ?? null,
  };
}
