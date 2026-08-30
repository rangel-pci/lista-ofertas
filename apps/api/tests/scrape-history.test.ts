/**
 * Persistência e histórico do scraping — AC-3, AC-4, AC-5, AC-14, AC-15.
 *
 * Estratégia: em vez de acessar o site real do União Supermercados (rede,
 * flaky, conteúdo muda), um servidor HTTP local (`mock-mercado-site.ts`)
 * serve fixtures HTML determinísticas, e o `Mercado.urlBase` (coluna já
 * definida no modelo de dados de design.md, seção 4.3) é apontado para
 * esse mock antes de disparar o webhook. Isso testa o comportamento real
 * de ponta a ponta (webhook → scraper → persistência) sem depender de
 * rede externa nem inventar nenhum mecanismo de injeção de dependência
 * que não estivesse já no modelo de dados aprovado pelo design.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.WEBHOOK_SECRET = "chave-secreta-de-teste";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/lista_ofertas_test";

// @ts-expect-error - módulo de produção ainda não existe; este teste define o contrato esperado.
import { buildApp } from "../src/app";
import { getMercadoUniao, resetOfertasEExecucoes } from "./support/test-db";
import {
  startMockMercadoSite,
  type MockMercadoSite,
} from "./support/mock-mercado-site";
import { waitForScrapeRunCompletion } from "./support/wait-for-scrape-run";
// @ts-expect-error - módulo de produção ainda não existe; este teste define o contrato esperado.
import { prisma } from "../src/db";

const __dirname = dirname(fileURLToPath(import.meta.url));
function fixture(name: string) {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

async function triggerScrapeRunAndWait(app: any) {
  const trigger = await app.inject({
    method: "POST",
    url: "/api/scrape-runs",
    headers: { "x-webhook-key": "chave-secreta-de-teste" },
  });
  const { id } = trigger.json();
  const finalState = await waitForScrapeRunCompletion(app, id);
  return { id, finalState };
}

describe("Histórico e persistência de execuções de scraping", () => {
  let app: any;
  let mock: MockMercadoSite;
  let mercadoUniaoId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetOfertasEExecucoes();
    const mercado = await getMercadoUniao();
    mercadoUniaoId = mercado.id;
  });

  afterEach(async () => {
    if (mock) await mock.close();
  });

  it("AC-3: percorre TODAS as campanhas da listagem e persiste todos os produtos de cada uma", async () => {
    mock = await startMockMercadoSite({
      "/promocoes": { status: 200, html: fixture("promocoes-execucao-1.html") },
      "/promocoes/campanha/00000000000000/9066": {
        status: 200,
        html: fixture("campanha-9066-execucao-1.html"),
      },
    });
    await prisma.mercado.update({
      where: { id: mercadoUniaoId },
      data: { urlBase: mock.baseUrl },
    });

    const { finalState } = await triggerScrapeRunAndWait(app);
    expect(finalState.status).toBe("SUCCESS");

    const ofertas = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId },
    });

    expect(ofertas).toHaveLength(2);
    const plus = ofertas.map((o: { plu: string }) => o.plu).sort();
    expect(plus).toEqual(["0136700", "1046772"]);

    for (const oferta of ofertas) {
      expect(oferta).toEqual(
        expect.objectContaining({
          mercadoId: mercadoUniaoId,
          plu: expect.any(String),
          nomeProduto: expect.any(String),
          preco: expect.anything(),
        }),
      );
      expect(oferta.campanhaId).toBeTruthy();
      expect(oferta.capturadoEm).toBeTruthy();
    }

    const campanha = await prisma.campanha.findFirst({
      where: { mercadoId: mercadoUniaoId },
    });
    expect(campanha).toEqual(
      expect.objectContaining({
        nome: "FIM DE SEMANA",
        tipo: "REDE",
        urlOrigem: expect.stringContaining("/promocoes/campanha/00000000000000/9066"),
      }),
    );
    expect(campanha.dataInicio).toBeTruthy();
    expect(campanha.dataFim).toBeTruthy();
  });

  it("AC-4 e AC-5: duas execuções em datas diferentes preservam AMBOS os preços da mesma oferta", async () => {
    // 1ª execução.
    mock = await startMockMercadoSite({
      "/promocoes": { status: 200, html: fixture("promocoes-execucao-1.html") },
      "/promocoes/campanha/00000000000000/9066": {
        status: 200,
        html: fixture("campanha-9066-execucao-1.html"),
      },
    });
    await prisma.mercado.update({
      where: { id: mercadoUniaoId },
      data: { urlBase: mock.baseUrl },
    });
    const primeira = await triggerScrapeRunAndWait(app);
    expect(primeira.finalState.status).toBe("SUCCESS");
    await mock.close();

    // 2ª execução: mesma campanha (mesma identidade de origem), preço do
    // PLU 1046772 mudou de R$ 15,99 para R$ 13,49.
    mock = await startMockMercadoSite({
      "/promocoes": { status: 200, html: fixture("promocoes-execucao-2.html") },
      "/promocoes/campanha/00000000000000/9066": {
        status: 200,
        html: fixture("campanha-9066-execucao-2.html"),
      },
    });
    await prisma.mercado.update({
      where: { id: mercadoUniaoId },
      data: { urlBase: mock.baseUrl },
    });
    const segunda = await triggerScrapeRunAndWait(app);
    expect(segunda.finalState.status).toBe("SUCCESS");

    // AC-4: os dados da 1ª execução continuam consultáveis.
    const ofertasDoPluNaPrimeiraExecucao = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId, plu: "1046772", scrapeRunId: primeira.id },
    });
    expect(ofertasDoPluNaPrimeiraExecucao).toHaveLength(1);
    expect(Number(ofertasDoPluNaPrimeiraExecucao[0].preco)).toBeCloseTo(15.99, 2);

    // A oferta do PLU 0136700, presente só na 1ª execução, também não foi apagada.
    const ofertaSoDaPrimeiraExecucao = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId, plu: "0136700" },
    });
    expect(ofertaSoDaPrimeiraExecucao).toHaveLength(1);

    // AC-5: mesmo PLU, mesma campanha, preço diferente na 2ª execução — ambos consultáveis.
    const ofertasDoPluNaSegundaExecucao = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId, plu: "1046772", scrapeRunId: segunda.id },
    });
    expect(ofertasDoPluNaSegundaExecucao).toHaveLength(1);
    expect(Number(ofertasDoPluNaSegundaExecucao[0].preco)).toBeCloseTo(13.49, 2);

    const todasAsOfertasDoPlu = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId, plu: "1046772" },
    });
    expect(todasAsOfertasDoPlu).toHaveLength(2);
    const precos = todasAsOfertasDoPlu
      .map((o: { preco: unknown }) => Number(o.preco))
      .sort((a: number, b: number) => a - b);
    expect(precos[0]).toBeCloseTo(13.49, 2);
    expect(precos[1]).toBeCloseTo(15.99, 2);
  });

  it("AC-13/ADR-3: a listagem pública mostra apenas a execução SUCCESS mais recente, sem duplicar a mesma oferta de execuções antigas", async () => {
    // Design.md, seção 4.4/ADR-3: o histórico completo (RF-2/RF-3) é
    // preservado em OfertaCapturada, mas a listagem pública (GET
    // /api/ofertas) reconcilia isso com "mostrar o estado atual" ao
    // considerar somente a última execução SUCCESS de cada mercado. Sem
    // esse filtro, o mesmo PLU apareceria duas vezes (uma por execução) na
    // tela principal, o que violaria AC-13 (card por oferta, não por
    // execução histórica).

    // 1ª execução.
    mock = await startMockMercadoSite({
      "/promocoes": { status: 200, html: fixture("promocoes-execucao-1.html") },
      "/promocoes/campanha/00000000000000/9066": {
        status: 200,
        html: fixture("campanha-9066-execucao-1.html"),
      },
    });
    await prisma.mercado.update({
      where: { id: mercadoUniaoId },
      data: { urlBase: mock.baseUrl },
    });
    await triggerScrapeRunAndWait(app);
    await mock.close();

    // 2ª execução: mesma campanha, PLU 1046772 com preço diferente (R$ 13,49).
    mock = await startMockMercadoSite({
      "/promocoes": { status: 200, html: fixture("promocoes-execucao-2.html") },
      "/promocoes/campanha/00000000000000/9066": {
        status: 200,
        html: fixture("campanha-9066-execucao-2.html"),
      },
    });
    await prisma.mercado.update({
      where: { id: mercadoUniaoId },
      data: { urlBase: mock.baseUrl },
    });
    const segunda = await triggerScrapeRunAndWait(app);
    expect(segunda.finalState.status).toBe("SUCCESS");

    // A tabela de histórico continua com as duas versões do PLU (RF-3/AC-4/AC-5).
    const historicoCompleto = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId, plu: "1046772" },
    });
    expect(historicoCompleto).toHaveLength(2);

    // Mas a listagem pública mostra o PLU 1046772 uma única vez, com o
    // preço da execução mais recente.
    const listagemPublica = await app.inject({
      method: "GET",
      url: "/api/ofertas?mercado=uniao-supermercados",
    });
    expect(listagemPublica.statusCode).toBe(200);
    const body = listagemPublica.json();
    const lista = Array.isArray(body) ? body : body.items;

    const itensDoPlu = lista.filter((o: { plu: string }) => o.plu === "1046772");
    expect(itensDoPlu).toHaveLength(1);
    expect(Number(itensDoPlu[0].preco)).toBeCloseTo(13.49, 2);
  });

  it("AC-14: uma execução com falha (site indisponível) não apaga nem altera dados de execuções anteriores", async () => {
    // 1ª execução: sucesso.
    mock = await startMockMercadoSite({
      "/promocoes": { status: 200, html: fixture("promocoes-execucao-1.html") },
      "/promocoes/campanha/00000000000000/9066": {
        status: 200,
        html: fixture("campanha-9066-execucao-1.html"),
      },
    });
    await prisma.mercado.update({
      where: { id: mercadoUniaoId },
      data: { urlBase: mock.baseUrl },
    });
    const primeira = await triggerScrapeRunAndWait(app);
    expect(primeira.finalState.status).toBe("SUCCESS");

    const ofertasAntes = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId },
    });
    expect(ofertasAntes).toHaveLength(2);
    await mock.close();

    // 2ª execução: site "indisponível" (mock derrubado / responde 500).
    mock = await startMockMercadoSite({
      "/promocoes": { status: 500, html: "<html><body>erro interno</body></html>" },
    });
    await prisma.mercado.update({
      where: { id: mercadoUniaoId },
      data: { urlBase: mock.baseUrl },
    });
    const segunda = await triggerScrapeRunAndWait(app);

    expect(segunda.finalState.status).toBe("FAILED");
    expect(segunda.finalState.errorMessage).toBeTruthy();

    const ofertasDepois = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId },
    });
    expect(ofertasDepois).toHaveLength(2);
    expect(ofertasDepois.map((o: { id: string }) => o.id).sort()).toEqual(
      ofertasAntes.map((o: { id: string }) => o.id).sort(),
    );
  });

  it("AC-15: adicionar um segundo mercado não altera os registros já existentes do União Supermercados", async () => {
    mock = await startMockMercadoSite({
      "/promocoes": { status: 200, html: fixture("promocoes-execucao-1.html") },
      "/promocoes/campanha/00000000000000/9066": {
        status: 200,
        html: fixture("campanha-9066-execucao-1.html"),
      },
    });
    await prisma.mercado.update({
      where: { id: mercadoUniaoId },
      data: { urlBase: mock.baseUrl },
    });
    await triggerScrapeRunAndWait(app);

    const ofertasAntes = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId },
    });
    const campanhasAntes = await prisma.campanha.findMany({
      where: { mercadoId: mercadoUniaoId },
    });
    expect(ofertasAntes.length).toBeGreaterThan(0);

    const novoMercado = await prisma.mercado.create({
      data: {
        slug: "mercado-teste-extensibilidade",
        nome: "Mercado de Teste (AC-15)",
        urlBase: "https://mercado-teste.invalid",
        ativo: false,
      },
    });

    const ofertasDepois = await prisma.ofertaCapturada.findMany({
      where: { mercadoId: mercadoUniaoId },
    });
    const campanhasDepois = await prisma.campanha.findMany({
      where: { mercadoId: mercadoUniaoId },
    });

    expect(ofertasDepois).toEqual(ofertasAntes);
    expect(campanhasDepois).toEqual(campanhasAntes);

    const mercados = await app.inject({ method: "GET", url: "/api/mercados" });
    expect(mercados.statusCode).toBe(200);
    const slugs = mercados.json().map((m: { slug: string }) => m.slug);
    expect(slugs).toContain("uniao-supermercados");
    expect(slugs).toContain("mercado-teste-extensibilidade");

    await prisma.mercado.delete({ where: { id: novoMercado.id } });
  });
});
