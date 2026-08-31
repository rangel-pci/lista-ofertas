/**
 * Cliente da API pública de consulta (`apps/api`). Sem autenticação: o
 * frontend é público (AC-6).
 */
export const API_BASE_URL =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export interface Mercado {
  id: string;
  slug: string;
  nome: string;
  ativo: boolean;
}

export interface Oferta {
  id: string;
  plu: string;
  nomeProduto: string;
  preco: number;
  capturadoEm: string;
  mercado: { id: string; slug: string; nome: string };
  campanha: {
    id: string;
    nome: string;
    tipo: string;
    dataInicio: string | null;
    dataFim: string | null;
    urlOrigem: string;
  };
  cidade: string | null;
}

export interface PaginaDeOfertas {
  items: Oferta[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const ORDENACOES = [
  { valor: "recentes", rotulo: "Mais recentes" },
  { valor: "preco_asc", rotulo: "Preço crescente" },
  { valor: "preco_desc", rotulo: "Preço decrescente" },
  { valor: "nome_asc", rotulo: "Nome A-Z" },
  { valor: "nome_desc", rotulo: "Nome Z-A" },
] as const;

async function buscar<T>(caminho: string, padrao: T): Promise<T> {
  try {
    const resposta = await fetch(`${API_BASE_URL}${caminho}`, { cache: "no-store" });
    if (!resposta.ok) return padrao;
    return (await resposta.json()) as T;
  } catch {
    // A listagem pública não deve quebrar quando a API está indisponível: a
    // página mostra o estado vazio em vez de uma tela de erro.
    return padrao;
  }
}

export function montarQueryString(filtros: Record<string, string | undefined>): string {
  const parametros = new URLSearchParams();

  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) parametros.set(chave, valor);
  }

  const query = parametros.toString();
  return query ? `?${query}` : "";
}

export function buscarOfertas(
  filtros: Record<string, string | undefined>,
): Promise<PaginaDeOfertas> {
  return buscar<PaginaDeOfertas>(`/api/ofertas${montarQueryString(filtros)}`, {
    items: [],
    total: 0,
    page: 1,
    pageSize: 0,
    totalPages: 0,
  });
}

export function buscarMercados(): Promise<Mercado[]> {
  return buscar<Mercado[]>("/api/mercados", []);
}

export function buscarCidades(): Promise<string[]> {
  return buscar<string[]>("/api/cidades", []);
}
