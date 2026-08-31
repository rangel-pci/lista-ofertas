/**
 * Seed determinístico para os testes da API pública de consulta
 * (GET /api/ofertas, /api/mercados, /api/cidades). Insere dados
 * diretamente via Prisma, contornando o scraper: os testes de filtro e
 * ordenação validam a camada de consulta, não a extração (que já tem
 * suíte própria em packages/scraping e em scrape-history.test.ts).
 *
 * Importante (ADR-3 do design.md): a listagem pública só mostra a última
 * execução SUCCESS de cada mercado. Por isso cada oferta semeada aqui
 * pertence a um ScrapeRun com status SUCCESS.
 *
 * De propósito, `prisma` é recebido por parâmetro em vez de importado aqui:
 * um `import` estático de `../../src/db` (módulo de produção ainda
 * inexistente) derrubaria a COLETA de qualquer arquivo de teste que
 * importasse este helper, escondendo os casos de teste individuais no
 * relatório (ver nota equivalente no topo de cada `*.test.ts`).
 */
export interface SeedResult {
  mercadoUniaoId: string;
  mercadoComCidadeId: string;
  ofertaAcai: any;
  ofertaCafe: any;
  ofertaArroz: any;
}

/**
 * Cria um segundo mercado (com uma loja/cidade associada) e popula ofertas
 * cobrindo: nomes distintos (busca/ordenação alfabética), preços distintos
 * (ordenação por preço), datas de vigência distintas (filtro por data) e
 * uma oferta com cidade associável via loja (AC-9 positivo).
 */
export async function seedCenarioDeConsulta(prisma: any): Promise<SeedResult> {
  const mercadoUniao = await prisma.mercado.findUniqueOrThrow({
    where: { slug: "uniao-supermercados" },
  });

  // `resetOfertasEExecucoes` preserva os registros de catálogo (Mercado/Loja),
  // então o mercado sintético deste cenário sobrevive ao teste anterior e
  // precisa ser removido antes de ser recriado: sem isso, o segundo `beforeEach`
  // esbarraria na unicidade de `slug`.
  await prisma.loja.deleteMany({
    where: { mercado: { slug: "mercado-com-loja-teste" } },
  });
  await prisma.mercado.deleteMany({ where: { slug: "mercado-com-loja-teste" } });

  const mercadoComCidade = await prisma.mercado.create({
    data: {
      slug: "mercado-com-loja-teste",
      nome: "Mercado Com Loja (teste)",
      urlBase: "https://mercado-com-loja-teste.invalid",
      ativo: true,
    },
  });

  const loja = await prisma.loja.create({
    data: {
      mercadoId: mercadoComCidade.id,
      nome: "Loja Centro",
      endereco: "Rua Teste, 123",
      cidade: "Rio de Janeiro",
      uf: "RJ",
      cep: "20000-000",
      telefone: "(21) 0000-0000",
      horario: "08h-22h",
    },
  });

  const scrapeRunUniao = await prisma.scrapeRun.create({
    data: {
      mercadoId: mercadoUniao.id,
      status: "SUCCESS",
      startedAt: new Date("2026-08-28T08:00:00Z"),
      finishedAt: new Date("2026-08-28T08:05:00Z"),
    },
  });

  const scrapeRunComLoja = await prisma.scrapeRun.create({
    data: {
      mercadoId: mercadoComCidade.id,
      status: "SUCCESS",
      startedAt: new Date("2026-09-01T08:00:00Z"),
      finishedAt: new Date("2026-09-01T08:05:00Z"),
    },
  });

  const campanhaFimDeSemana = await prisma.campanha.create({
    data: {
      mercadoId: mercadoUniao.id,
      codigoOrigem: "00000000000000",
      idOrigem: "9066",
      nome: "FIM DE SEMANA",
      tipo: "REDE",
      dataInicio: new Date("2026-08-28"),
      dataFim: new Date("2026-08-31"),
      urlOrigem:
        "https://www.uniaosupermercados.com/promocoes/campanha/00000000000000/9066",
      primeiraVistaEm: new Date("2026-08-28T08:00:00Z"),
      ultimaVistaEm: new Date("2026-08-28T08:00:00Z"),
    },
  });

  const campanhaLoja = await prisma.campanha.create({
    data: {
      mercadoId: mercadoComCidade.id,
      codigoOrigem: "loja-centro",
      idOrigem: "loja-1",
      nome: "OFERTAS DA LOJA CENTRO",
      tipo: "LOJA",
      lojaId: loja.id,
      dataInicio: new Date("2026-09-01"),
      dataFim: new Date("2026-09-07"),
      urlOrigem: "https://mercado-com-loja-teste.invalid/promocoes/loja-centro",
      primeiraVistaEm: new Date("2026-09-01T08:00:00Z"),
      ultimaVistaEm: new Date("2026-09-01T08:00:00Z"),
    },
  });

  const ofertaAcai = await prisma.ofertaCapturada.create({
    data: {
      scrapeRunId: scrapeRunUniao.id,
      campanhaId: campanhaFimDeSemana.id,
      mercadoId: mercadoUniao.id,
      plu: "1046772",
      nomeProduto: "ACAI ORIGEM 1,5L",
      preco: "15.99",
      capturadoEm: new Date("2026-08-28T08:05:00Z"),
    },
  });

  const ofertaCafe = await prisma.ofertaCapturada.create({
    data: {
      scrapeRunId: scrapeRunUniao.id,
      campanhaId: campanhaFimDeSemana.id,
      mercadoId: mercadoUniao.id,
      plu: "0136700",
      nomeProduto: "CAFE DO SITIO 500G",
      preco: "21.99",
      capturadoEm: new Date("2026-08-28T08:05:00Z"),
    },
  });

  const ofertaArroz = await prisma.ofertaCapturada.create({
    data: {
      scrapeRunId: scrapeRunComLoja.id,
      campanhaId: campanhaLoja.id,
      mercadoId: mercadoComCidade.id,
      plu: "2000001",
      nomeProduto: "ARROZ TIPO 1 5KG",
      preco: "24.90",
      capturadoEm: new Date("2026-09-01T08:05:00Z"),
    },
  });

  return {
    mercadoUniaoId: mercadoUniao.id,
    mercadoComCidadeId: mercadoComCidade.id,
    ofertaAcai,
    ofertaCafe,
    ofertaArroz,
  };
}

export async function limparCenarioDeConsulta(prisma: any, mercadoComCidadeId: string) {
  await prisma.ofertaCapturada.deleteMany({});
  await prisma.campanha.deleteMany({});
  await prisma.scrapeRun.deleteMany({});
  await prisma.loja.deleteMany({ where: { mercadoId: mercadoComCidadeId } });
  await prisma.mercado.deleteMany({ where: { id: mercadoComCidadeId } });
}
