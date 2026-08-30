/**
 * Helpers de banco de dados para os testes de integração da API.
 *
 * Contrato assumido (design.md, seção 4.3 e 5):
 * - `../../src/db` exporta um `PrismaClient` singleton chamado `prisma`.
 * - As migrations Prisma já foram aplicadas no banco de teste apontado por
 *   `DATABASE_URL` antes de rodar esta suíte (ver tests/README.md).
 * - A migration/seed inicial cria uma linha em `Mercado` para o União
 *   Supermercados (slug "uniao-supermercados"), conforme a unidade de
 *   trabalho 2 do design.
 *
 * Este helper não decide como o schema é versionado; ele só limpa as
 * tabelas de fato (append-only) e de identidade entre os testes para
 * garantir isolamento e determinismo (nenhum teste deve depender da ordem
 * de execução nem de dados deixados por outro teste).
 */
// @ts-expect-error - módulo de produção ainda não existe; este teste define o contrato esperado.
import { prisma } from "../../src/db";

export const MERCADO_UNIAO_SLUG = "uniao-supermercados";

export async function getMercadoUniao() {
  const mercado = await prisma.mercado.findUnique({
    where: { slug: MERCADO_UNIAO_SLUG },
  });
  if (!mercado) {
    throw new Error(
      `Mercado seed "${MERCADO_UNIAO_SLUG}" não encontrado. A migration/seed ` +
        "inicial (design.md, unidade de trabalho 2) deve criar este registro " +
        "antes dos testes rodarem.",
    );
  }
  return mercado;
}

/**
 * Remove todos os dados de fato e histórico entre testes, preservando os
 * registros de catálogo semeados por migration (Mercado, Loja) para não
 * recriar fixtures de infraestrutura a cada teste.
 */
export async function resetOfertasEExecucoes() {
  await prisma.ofertaCapturada.deleteMany({});
  await prisma.scrapeRun.deleteMany({});
  await prisma.campanha.deleteMany({});
}

export async function disconnect() {
  await prisma.$disconnect();
}
