import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import { prisma } from "../db.js";
import {
  ORDENACOES,
  PAGE_SIZE_MAXIMO,
  listarCidadesDisponiveis,
  listarOfertas,
  type FiltrosDeOferta,
} from "../ofertas.js";

const SCHEMA_FILTROS = {
  type: "object",
  properties: {
    mercado: { type: "string" },
    cidade: { type: "string" },
    produto: { type: "string" },
    dataInicio: { type: "string" },
    dataFim: { type: "string" },
    capturadoDe: { type: "string" },
    capturadoAte: { type: "string" },
    sort: { type: "string", enum: [...ORDENACOES] },
    page: { type: "integer", minimum: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: PAGE_SIZE_MAXIMO },
  },
} as const;

/** API pública de consulta (design.md, seção 4.7). Sem autenticação (AC-6). */
export const consultaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get<{ Querystring: FiltrosDeOferta }>(
    "/api/ofertas",
    { schema: { querystring: SCHEMA_FILTROS } },
    async (request) => listarOfertas(prisma, limparFiltros(request.query)),
  );

  app.get("/api/mercados", async () => {
    const mercados = await prisma.mercado.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, slug: true, nome: true, urlBase: true, ativo: true },
    });

    return mercados;
  });

  app.get<{ Querystring: { mercado?: string } }>(
    "/api/cidades",
    {
      schema: {
        querystring: { type: "object", properties: { mercado: { type: "string" } } },
      },
    },
    async (request) =>
      listarCidadesDisponiveis(prisma, limparFiltros(request.query)),
  );
};

/** Trata parâmetro vazio (ex.: `?produto=`) como parâmetro ausente. */
function limparFiltros<T extends object>(query: T): T {
  const limpos: Record<string, unknown> = {};

  for (const [chave, valor] of Object.entries(query as Record<string, unknown>)) {
    if (typeof valor === "string") {
      const texto = valor.trim();
      if (texto) limpos[chave] = texto;
      continue;
    }
    if (valor !== undefined && valor !== null) limpos[chave] = valor;
  }

  return limpos as T;
}
