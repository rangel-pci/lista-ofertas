/**
 * API pública de consulta — AC-8 a AC-13.
 *
 * Contrato assumido a partir de design.md (seção 4.7), decisão já tomada
 * pelo Líder Técnico:
 *   GET /api/ofertas?mercado=&cidade=&dataInicio=&dataFim=&produto=&sort=
 *   sort ∈ {preco_asc, preco_desc, nome_asc, nome_desc}
 *   GET /api/mercados
 *   GET /api/cidades
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.WEBHOOK_SECRET = "chave-secreta-de-teste";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/lista_ofertas_test";

// @ts-expect-error - módulo de produção ainda não existe; este teste define o contrato esperado.
import { buildApp } from "../src/app";
import { resetOfertasEExecucoes } from "./support/test-db";
import {
  limparCenarioDeConsulta,
  seedCenarioDeConsulta,
  type SeedResult,
} from "./support/seed-ofertas";
// @ts-expect-error - módulo de produção ainda não existe; este teste define o contrato esperado.
import { prisma } from "../src/db";

describe("GET /api/ofertas, /api/mercados, /api/cidades", () => {
  let app: any;
  let seed: SeedResult;

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
    seed = await seedCenarioDeConsulta();
  });

  it("AC-13: cada oferta na listagem traz ao menos produto, preço, mercado e campanha/período", async () => {
    const response = await app.inject({ method: "GET", url: "/api/ofertas" });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    const lista = Array.isArray(body) ? body : body.items;
    expect(lista.length).toBeGreaterThanOrEqual(3);

    for (const oferta of lista) {
      expect(oferta.nomeProduto ?? oferta.nome_produto).toBeTruthy();
      expect(oferta.preco).toBeTruthy();
      expect(
        oferta.mercado?.nome ?? oferta.mercadoNome ?? oferta.mercado,
      ).toBeTruthy();
      expect(
        oferta.campanha?.nome ?? oferta.campanhaNome ?? oferta.campanha,
      ).toBeTruthy();
    }
  });

  it("AC-8: filtra a listagem por mercado", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/ofertas?mercado=uniao-supermercados",
    });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    const lista = Array.isArray(body) ? body : body.items;
    const plus = lista.map((o: any) => o.plu).sort();
    expect(plus).toEqual(["0136700", "1046772"]);
  });

  it("AC-9 (positivo): quando há cidade associável via loja, é possível filtrar por cidade", async () => {
    const cidades = await app.inject({ method: "GET", url: "/api/cidades" });
    expect(cidades.statusCode).toBe(200);
    expect(cidades.json()).toContain("Rio de Janeiro");

    const response = await app.inject({
      method: "GET",
      url: `/api/ofertas?${encodeURI("cidade=Rio de Janeiro")}`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const lista = Array.isArray(body) ? body : body.items;
    expect(lista).toHaveLength(1);
    expect(lista[0].plu).toBe("2000001");
  });

  it("AC-9 (negativo): quando nenhuma oferta do resultado tem cidade associável, /api/cidades não gera erro e retorna lista vazia", async () => {
    // Remove o cenário com loja/cidade; só resta o União Supermercados (campanhas de rede, sem cidade).
    await limparCenarioDeConsulta(seed.mercadoComCidadeId);
    const universaoOfertas = await prisma.mercado.findUniqueOrThrow({
      where: { slug: "uniao-supermercados" },
    });
    // Recria só a oferta de rede (sem loja/cidade) para não ficar com listagem vazia.
    const scrapeRun = await prisma.scrapeRun.create({
      data: {
        mercadoId: universaoOfertas.id,
        status: "SUCCESS",
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    const campanha = await prisma.campanha.create({
      data: {
        mercadoId: universaoOfertas.id,
        codigoOrigem: "00000000000000",
        idOrigem: "9066",
        nome: "FIM DE SEMANA",
        tipo: "REDE",
        dataInicio: new Date("2026-08-28"),
        dataFim: new Date("2026-08-31"),
        urlOrigem: "https://www.uniaosupermercados.com/promocoes/campanha/00000000000000/9066",
        primeiraVistaEm: new Date(),
        ultimaVistaEm: new Date(),
      },
    });
    await prisma.ofertaCapturada.create({
      data: {
        scrapeRunId: scrapeRun.id,
        campanhaId: campanha.id,
        mercadoId: universaoOfertas.id,
        plu: "1046772",
        nomeProduto: "ACAI ORIGEM 1,5L",
        preco: "15.99",
        capturadoEm: new Date(),
      },
    });

    const cidades = await app.inject({ method: "GET", url: "/api/cidades" });
    expect(cidades.statusCode).toBe(200);
    expect(cidades.json()).toEqual([]);

    const ofertas = await app.inject({ method: "GET", url: "/api/ofertas" });
    expect(ofertas.statusCode).toBe(200);
  });

  it("AC-10: filtra a listagem por data de vigência da promoção", async () => {
    const dentroDoPeriodoUniao = await app.inject({
      method: "GET",
      url: "/api/ofertas?dataInicio=2026-08-28&dataFim=2026-08-31",
    });
    expect(dentroDoPeriodoUniao.statusCode).toBe(200);
    const listaDentro = dentroDoPeriodoUniao.json();
    const itensDentro = Array.isArray(listaDentro) ? listaDentro : listaDentro.items;
    expect(itensDentro.map((o: any) => o.plu).sort()).toEqual([
      "0136700",
      "1046772",
    ]);

    const foraDoPeriodo = await app.inject({
      method: "GET",
      url: "/api/ofertas?dataInicio=2027-01-01&dataFim=2027-01-31",
    });
    expect(foraDoPeriodo.statusCode).toBe(200);
    const listaFora = foraDoPeriodo.json();
    const itensFora = Array.isArray(listaFora) ? listaFora : listaFora.items;
    expect(itensFora).toHaveLength(0);
  });

  it("AC-11: busca a listagem por parte do nome do produto", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/ofertas?produto=acai",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const lista = Array.isArray(body) ? body : body.items;
    expect(lista).toHaveLength(1);
    expect(lista[0].nomeProduto ?? lista[0].nome_produto).toMatch(/ACAI/i);
  });

  it("AC-11: busca por termo sem correspondência retorna lista vazia (sem erro)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/ofertas?produto=produto-que-nao-existe-em-nenhuma-oferta",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    const lista = Array.isArray(body) ? body : body.items;
    expect(lista).toHaveLength(0);
  });

  it("AC-12: ordena por preço crescente e decrescente", async () => {
    const asc = await app.inject({
      method: "GET",
      url: "/api/ofertas?sort=preco_asc",
    });
    const listaAsc = asc.json();
    const itensAsc = Array.isArray(listaAsc) ? listaAsc : listaAsc.items;
    const precosAsc = itensAsc.map((o: any) => Number(o.preco));
    expect(precosAsc).toEqual([...precosAsc].sort((a, b) => a - b));

    const desc = await app.inject({
      method: "GET",
      url: "/api/ofertas?sort=preco_desc",
    });
    const listaDesc = desc.json();
    const itensDesc = Array.isArray(listaDesc) ? listaDesc : listaDesc.items;
    const precosDesc = itensDesc.map((o: any) => Number(o.preco));
    expect(precosDesc).toEqual([...precosDesc].sort((a, b) => b - a));
  });

  it("AC-12: ordena por nome do produto A-Z e Z-A", async () => {
    const az = await app.inject({
      method: "GET",
      url: "/api/ofertas?sort=nome_asc",
    });
    const listaAz = az.json();
    const itensAz = Array.isArray(listaAz) ? listaAz : listaAz.items;
    const nomesAz = itensAz.map((o: any) => o.nomeProduto ?? o.nome_produto);
    expect(nomesAz).toEqual([...nomesAz].sort((a, b) => a.localeCompare(b)));

    const za = await app.inject({
      method: "GET",
      url: "/api/ofertas?sort=nome_desc",
    });
    const listaZa = za.json();
    const itensZa = Array.isArray(listaZa) ? listaZa : listaZa.items;
    const nomesZa = itensZa.map((o: any) => o.nomeProduto ?? o.nome_produto);
    expect(nomesZa).toEqual([...nomesZa].sort((a, b) => b.localeCompare(a)));
  });

  it("GET /api/mercados lista os mercados cadastrados", async () => {
    const response = await app.inject({ method: "GET", url: "/api/mercados" });
    expect(response.statusCode).toBe(200);
    const slugs = response.json().map((m: any) => m.slug);
    expect(slugs).toEqual(
      expect.arrayContaining(["uniao-supermercados", "mercado-com-loja-teste"]),
    );
  });
});
