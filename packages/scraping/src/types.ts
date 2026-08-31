/**
 * Contrato de extensão para novos mercados (RF-8 / ADR-5 do design.md).
 * Cada mercado cadastrado tem um adapter que implementa `MercadoScraper`.
 */
export type TipoCampanha = "REDE" | "LOJA";

export interface ProdutoExtraido {
  plu: string;
  nome: string;
  preco: number;
}

export interface CampanhaExtraida {
  /** Código da campanha na origem (primeiro segmento da URL de detalhe). */
  codigoOrigem: string;
  /** Identificador da campanha na origem (segundo segmento da URL de detalhe). */
  idOrigem: string;
  nome: string;
  tipo: TipoCampanha;
  /** Data no formato ISO `YYYY-MM-DD`, ou `null` quando a origem não informa. */
  dataInicio: string | null;
  dataFim: string | null;
  urlOrigem: string;
  produtos: ProdutoExtraido[];
}

export interface MercadoScraper {
  /** Slug do mercado correspondente na tabela `Mercado`. */
  readonly slug: string;
  scrape(): Promise<CampanhaExtraida[]>;
}

/**
 * Erro de extração. Existe como tipo próprio porque AC-14 exige que uma
 * mudança de estrutura na origem termine como falha registrada da execução,
 * nunca como dado parcial persistido como se fosse completo.
 */
export class ScrapingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ScrapingError";
  }
}
