import type { PrismaClient } from "@prisma/client";

import { criarScraper } from "./scrapers/registry.js";

export interface MercadoParaExecucao {
  id: string;
  slug: string;
  urlBase: string;
}

export interface LoggerDeExecucao {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

const LIMITE_MENSAGEM_ERRO = 2000;

/**
 * Execuções disparadas pelo webhook rodam no próprio processo (ADR-4). O
 * conjunto permite que o encerramento da aplicação aguarde o que está em voo,
 * em vez de deixar escrita pendente contra uma conexão já fechada.
 */
const execucoesEmAndamento = new Set<Promise<void>>();

export function dispararScrapeRunEmBackground(
  prisma: PrismaClient,
  entrada: {
    mercado: MercadoParaExecucao;
    scrapeRunId: string;
    logger?: LoggerDeExecucao;
  },
): void {
  const promessa = executarScrapeRun(prisma, entrada);
  execucoesEmAndamento.add(promessa);
  void promessa.finally(() => execucoesEmAndamento.delete(promessa));
}

export async function aguardarExecucoesEmAndamento(): Promise<void> {
  await Promise.allSettled([...execucoesEmAndamento]);
}

/**
 * Orquestra uma execução de scraping (design.md, unidade de trabalho 4).
 *
 * Regras que sustentam os critérios de aceite:
 * - a extração inteira acontece antes de qualquer escrita, e a escrita é uma
 *   única transação: uma falha no meio não deixa a execução com dados parciais
 *   (AC-14);
 * - ofertas são sempre inseridas, nunca atualizadas (append-only, AC-4/AC-5);
 * - a única entidade upsertada é `Campanha`, por identidade de origem, para não
 *   duplicar a campanha entre execuções.
 */
export async function executarScrapeRun(
  prisma: PrismaClient,
  {
    mercado,
    scrapeRunId,
    logger,
  }: {
    mercado: MercadoParaExecucao;
    scrapeRunId: string;
    logger?: LoggerDeExecucao;
  },
): Promise<void> {
  const inicio = Date.now();

  try {
    const scraper = criarScraper(mercado);
    const campanhas = await scraper.scrape();
    const capturadoEm = new Date();

    let totalDeOfertas = 0;

    await prisma.$transaction(async (tx) => {
      for (const campanhaExtraida of campanhas) {
        const campanha = await tx.campanha.upsert({
          where: {
            mercadoId_codigoOrigem_idOrigem: {
              mercadoId: mercado.id,
              codigoOrigem: campanhaExtraida.codigoOrigem,
              idOrigem: campanhaExtraida.idOrigem,
            },
          },
          update: {
            nome: campanhaExtraida.nome,
            tipo: campanhaExtraida.tipo,
            dataInicio: paraData(campanhaExtraida.dataInicio),
            dataFim: paraData(campanhaExtraida.dataFim),
            urlOrigem: campanhaExtraida.urlOrigem,
            ultimaVistaEm: capturadoEm,
          },
          create: {
            mercadoId: mercado.id,
            codigoOrigem: campanhaExtraida.codigoOrigem,
            idOrigem: campanhaExtraida.idOrigem,
            nome: campanhaExtraida.nome,
            tipo: campanhaExtraida.tipo,
            dataInicio: paraData(campanhaExtraida.dataInicio),
            dataFim: paraData(campanhaExtraida.dataFim),
            urlOrigem: campanhaExtraida.urlOrigem,
            primeiraVistaEm: capturadoEm,
            ultimaVistaEm: capturadoEm,
          },
        });

        if (campanhaExtraida.produtos.length > 0) {
          await tx.ofertaCapturada.createMany({
            data: campanhaExtraida.produtos.map((produto) => ({
              scrapeRunId,
              campanhaId: campanha.id,
              mercadoId: mercado.id,
              plu: produto.plu,
              nomeProduto: produto.nome,
              preco: produto.preco.toFixed(2),
              capturadoEm,
            })),
          });
          totalDeOfertas += campanhaExtraida.produtos.length;
        }
      }

      await tx.scrapeRun.update({
        where: { id: scrapeRunId },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          errorMessage: null,
          stats: {
            campanhas: campanhas.length,
            ofertas: totalDeOfertas,
            duracaoMs: Date.now() - inicio,
          },
        },
      });
    });

    logger?.info(
      {
        scrapeRunId,
        mercado: mercado.slug,
        campanhas: campanhas.length,
        ofertas: totalDeOfertas,
        duracaoMs: Date.now() - inicio,
      },
      "execução de scraping concluída com sucesso",
    );
  } catch (erro) {
    const mensagem = mensagemDe(erro);

    logger?.error(
      { scrapeRunId, mercado: mercado.slug, erro: mensagem },
      "execução de scraping falhou",
    );

    try {
      await prisma.scrapeRun.update({
        where: { id: scrapeRunId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorMessage: mensagem.slice(0, LIMITE_MENSAGEM_ERRO),
          stats: { duracaoMs: Date.now() - inicio },
        },
      });
    } catch (erroAoRegistrar) {
      // A execução pode ter sido removida (ex.: limpeza de ambiente) enquanto
      // rodava. Registrar a falha é best effort: o importante é não derrubar o
      // processo nem tocar dados de execuções anteriores.
      logger?.error(
        { scrapeRunId, erro: mensagemDe(erroAoRegistrar) },
        "não foi possível registrar a falha da execução",
      );
    }
  }
}

function paraData(valor: string | null): Date | null {
  if (!valor) return null;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(data.getTime()) ? null : data;
}

function mensagemDe(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.cause instanceof Error ? `${erro.message} (causa: ${erro.cause.message})` : erro.message;
  }
  return String(erro);
}
