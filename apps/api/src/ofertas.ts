import type { Prisma, PrismaClient } from "@prisma/client";

export const ORDENACOES = [
  "recentes",
  "preco_asc",
  "preco_desc",
  "nome_asc",
  "nome_desc",
] as const;

export type Ordenacao = (typeof ORDENACOES)[number];

export const PAGE_SIZE_PADRAO = 50;
export const PAGE_SIZE_MAXIMO = 200;

export interface FiltrosDeOferta {
  mercado?: string;
  cidade?: string;
  produto?: string;
  /** Vigência da campanha: sobreposição com o intervalo informado (AC-10). */
  dataInicio?: string;
  dataFim?: string;
  /** Data de captura pelo scraping (AC-10, segunda alternativa). */
  capturadoDe?: string;
  capturadoAte?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export class ParametroInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParametroInvalidoError";
  }
}

export interface OfertaPublica {
  id: string;
  plu: string;
  nomeProduto: string;
  preco: number;
  capturadoEm: string;
  scrapeRunId: string;
  mercado: { id: string; slug: string; nome: string };
  campanha: {
    id: string;
    nome: string;
    tipo: string;
    dataInicio: string | null;
    dataFim: string | null;
    urlOrigem: string;
  };
  loja: { id: string; nome: string; cidade: string; uf: string | null } | null;
  cidade: string | null;
}

export interface PaginaDeOfertas {
  items: OfertaPublica[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const INCLUDE_PUBLICO = {
  mercado: { select: { id: true, slug: true, nome: true } },
  campanha: {
    select: {
      id: true,
      nome: true,
      tipo: true,
      dataInicio: true,
      dataFim: true,
      urlOrigem: true,
      loja: { select: { id: true, nome: true, cidade: true, uf: true } },
    },
  },
} satisfies Prisma.OfertaCapturadaInclude;

/**
 * Identifica a última execução bem-sucedida de cada mercado (ADR-3).
 *
 * O histórico completo continua em `OfertaCapturada` (RF-2/RF-3); a listagem
 * pública é restrita a essas execuções para mostrar o estado atual sem repetir
 * a mesma oferta uma vez por execução histórica.
 */
export async function idsDasUltimasExecucoesComSucesso(
  prisma: PrismaClient,
): Promise<string[]> {
  const execucoes = await prisma.scrapeRun.findMany({
    where: { status: "SUCCESS" },
    select: { id: true, mercadoId: true },
    orderBy: [{ startedAt: "desc" }, { finishedAt: "desc" }],
  });

  const ultimaPorMercado = new Map<string, string>();
  for (const execucao of execucoes) {
    if (!ultimaPorMercado.has(execucao.mercadoId)) {
      ultimaPorMercado.set(execucao.mercadoId, execucao.id);
    }
  }

  return [...ultimaPorMercado.values()];
}

export async function listarOfertas(
  prisma: PrismaClient,
  filtros: FiltrosDeOferta,
): Promise<PaginaDeOfertas> {
  const page = normalizarPagina(filtros.page);
  const pageSize = normalizarTamanhoDePagina(filtros.pageSize);
  const runIds = await idsDasUltimasExecucoesComSucesso(prisma);

  if (runIds.length === 0) {
    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  const where = montarWhere(runIds, filtros);

  const [total, registros] = await Promise.all([
    prisma.ofertaCapturada.count({ where }),
    prisma.ofertaCapturada.findMany({
      where,
      include: INCLUDE_PUBLICO,
      orderBy: montarOrdenacao(filtros.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: registros.map(paraOfertaPublica),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Cidades associáveis às ofertas da listagem atual (AC-9). Retorna lista vazia
 * quando nenhuma oferta vem de campanha de loja: é o sinal que o frontend usa
 * para ocultar o filtro de cidade, sem erro.
 */
export async function listarCidadesDisponiveis(
  prisma: PrismaClient,
  filtros: Pick<FiltrosDeOferta, "mercado"> = {},
): Promise<string[]> {
  const runIds = await idsDasUltimasExecucoesComSucesso(prisma);
  if (runIds.length === 0) return [];

  const campanhas = await prisma.campanha.findMany({
    where: {
      lojaId: { not: null },
      ...(filtros.mercado ? { mercado: { slug: filtros.mercado } } : {}),
      ofertas: { some: { scrapeRunId: { in: runIds } } },
    },
    select: { loja: { select: { cidade: true } } },
  });

  const cidades = new Set<string>();
  for (const campanha of campanhas) {
    if (campanha.loja?.cidade) cidades.add(campanha.loja.cidade);
  }

  return [...cidades].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function montarWhere(
  runIds: string[],
  filtros: FiltrosDeOferta,
): Prisma.OfertaCapturadaWhereInput {
  const where: Prisma.OfertaCapturadaWhereInput = {
    scrapeRunId: { in: runIds },
  };

  if (filtros.mercado) {
    where.mercado = { slug: filtros.mercado };
  }

  if (filtros.produto) {
    where.nomeProduto = { contains: filtros.produto, mode: "insensitive" };
  }

  const capturadoEm: Prisma.DateTimeFilter = {};
  if (filtros.capturadoDe) {
    capturadoEm.gte = paraInicioDoDia(filtros.capturadoDe, "capturadoDe");
  }
  if (filtros.capturadoAte) {
    capturadoEm.lte = paraFimDoDia(filtros.capturadoAte, "capturadoAte");
  }
  if (Object.keys(capturadoEm).length > 0) {
    where.capturadoEm = capturadoEm;
  }

  const condicoesDaCampanha: Prisma.CampanhaWhereInput[] = [];

  if (filtros.cidade) {
    condicoesDaCampanha.push({
      loja: { cidade: { equals: filtros.cidade, mode: "insensitive" } },
    });
  }

  // Vigência: a campanha é considerada quando seu período se sobrepõe ao
  // intervalo pedido. Campanha sem data na origem não é excluída por data.
  if (filtros.dataInicio) {
    const limite = paraInicioDoDia(filtros.dataInicio, "dataInicio");
    condicoesDaCampanha.push({ OR: [{ dataFim: null }, { dataFim: { gte: limite } }] });
  }
  if (filtros.dataFim) {
    const limite = paraFimDoDia(filtros.dataFim, "dataFim");
    condicoesDaCampanha.push({ OR: [{ dataInicio: null }, { dataInicio: { lte: limite } }] });
  }

  if (condicoesDaCampanha.length > 0) {
    where.campanha = { AND: condicoesDaCampanha };
  }

  return where;
}

function montarOrdenacao(sort?: string): Prisma.OfertaCapturadaOrderByWithRelationInput[] {
  const ordenacao = normalizarOrdenacao(sort);

  switch (ordenacao) {
    case "preco_asc":
      return [{ preco: "asc" }, { nomeProduto: "asc" }];
    case "preco_desc":
      return [{ preco: "desc" }, { nomeProduto: "asc" }];
    case "nome_asc":
      return [{ nomeProduto: "asc" }, { preco: "asc" }];
    case "nome_desc":
      return [{ nomeProduto: "desc" }, { preco: "asc" }];
    default:
      return [{ capturadoEm: "desc" }, { nomeProduto: "asc" }];
  }
}

export function normalizarOrdenacao(sort?: string): Ordenacao {
  if (!sort) return "recentes";
  if ((ORDENACOES as readonly string[]).includes(sort)) return sort as Ordenacao;
  throw new ParametroInvalidoError(
    `Ordenação "${sort}" não suportada. Valores aceitos: ${ORDENACOES.join(", ")}.`,
  );
}

function normalizarPagina(page?: number): number {
  if (page === undefined) return 1;
  if (!Number.isInteger(page) || page < 1) {
    throw new ParametroInvalidoError("O parâmetro page deve ser um inteiro maior ou igual a 1.");
  }
  return page;
}

function normalizarTamanhoDePagina(pageSize?: number): number {
  if (pageSize === undefined) return PAGE_SIZE_PADRAO;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PAGE_SIZE_MAXIMO) {
    throw new ParametroInvalidoError(
      `O parâmetro pageSize deve ser um inteiro entre 1 e ${PAGE_SIZE_MAXIMO}.`,
    );
  }
  return pageSize;
}

function paraInicioDoDia(valor: string, parametro: string): Date {
  return paraData(valor, parametro, "T00:00:00.000Z");
}

function paraFimDoDia(valor: string, parametro: string): Date {
  return paraData(valor, parametro, "T23:59:59.999Z");
}

function paraData(valor: string, parametro: string, sufixo: string): Date {
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const data = new Date(somenteData ? `${valor}${sufixo}` : valor);

  if (Number.isNaN(data.getTime())) {
    throw new ParametroInvalidoError(
      `O parâmetro ${parametro} deve ser uma data no formato AAAA-MM-DD.`,
    );
  }

  return data;
}

type RegistroDeOferta = Prisma.OfertaCapturadaGetPayload<{ include: typeof INCLUDE_PUBLICO }>;

function paraOfertaPublica(registro: RegistroDeOferta): OfertaPublica {
  return {
    id: registro.id,
    plu: registro.plu,
    nomeProduto: registro.nomeProduto,
    preco: Number(registro.preco),
    capturadoEm: registro.capturadoEm.toISOString(),
    scrapeRunId: registro.scrapeRunId,
    mercado: registro.mercado,
    campanha: {
      id: registro.campanha.id,
      nome: registro.campanha.nome,
      tipo: registro.campanha.tipo,
      dataInicio: registro.campanha.dataInicio?.toISOString() ?? null,
      dataFim: registro.campanha.dataFim?.toISOString() ?? null,
      urlOrigem: registro.campanha.urlOrigem,
    },
    loja: registro.campanha.loja,
    cidade: registro.campanha.loja?.cidade ?? null,
  };
}
