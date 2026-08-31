import * as cheerio from "cheerio";

import { extrairDatasISO, normalizarTexto, parsePrecoBrasileiro } from "./html.js";
import {
  ScrapingError,
  type CampanhaExtraida,
  type MercadoScraper,
  type ProdutoExtraido,
  type TipoCampanha,
} from "./types.js";

export const UNIAO_SUPERMERCADOS_SLUG = "uniao-supermercados";
export const UNIAO_SUPERMERCADOS_URL_BASE = "https://www.uniaosupermercados.com";

const CAMINHO_LISTAGEM = "/promocoes";
const TIMEOUT_PADRAO_MS = 20_000;

export interface UniaoSupermercadosScraperOptions {
  /** URL base do site. Configurável para apontar para outro host sem alterar código. */
  baseUrl?: string;
  timeoutMs?: number;
}

interface ReferenciaDeCampanha {
  codigoOrigem: string;
  idOrigem: string;
  nome: string;
  tipo: TipoCampanha;
  dataInicio: string | null;
  dataFim: string | null
  urlOrigem: string;
}

/**
 * Scraper do União Supermercados (RF-1, RF-2).
 *
 * O site é renderizado no servidor e não tem API JSON subjacente (ver
 * design.md, seção 2), então a extração é feita por requisição HTTP simples
 * mais parsing de HTML. Percorre TODAS as campanhas da listagem e, para cada
 * uma, a respectiva página de detalhe.
 */
export class UniaoSupermercadosScraper implements MercadoScraper {
  readonly slug = UNIAO_SUPERMERCADOS_SLUG;

  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: UniaoSupermercadosScraperOptions = {}) {
    this.baseUrl = (options.baseUrl ?? UNIAO_SUPERMERCADOS_URL_BASE).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? TIMEOUT_PADRAO_MS;
  }

  async scrape(): Promise<CampanhaExtraida[]> {
    const listagemHtml = await this.buscarHtml(this.urlAbsoluta(CAMINHO_LISTAGEM));
    const referencias = this.extrairReferenciasDeCampanha(listagemHtml);

    const campanhas: CampanhaExtraida[] = [];
    for (const referencia of referencias) {
      const detalheHtml = await this.buscarHtml(referencia.urlOrigem);
      campanhas.push({
        ...referencia,
        produtos: this.extrairProdutos(detalheHtml, referencia),
      });
    }

    return campanhas;
  }

  private urlAbsoluta(caminhoOuUrl: string): string {
    return new URL(caminhoOuUrl, `${this.baseUrl}/`).toString();
  }

  private async buscarHtml(url: string): Promise<string> {
    let resposta: Response;
    try {
      resposta = await globalThis.fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "lista-ofertas-bot/1.0 (+scraping de promocoes publicas)",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      throw new ScrapingError(`Falha ao acessar ${url}: ${mensagemDe(cause)}`, { cause });
    }

    if (!resposta.ok) {
      throw new ScrapingError(
        `Falha ao acessar ${url}: a origem respondeu com status ${resposta.status}`,
      );
    }

    return resposta.text();
  }

  private extrairReferenciasDeCampanha(html: string): ReferenciaDeCampanha[] {
    const $ = cheerio.load(html);
    const cards = $("article.network-promo-card, .network-promo-card");

    if (cards.length === 0) {
      const estruturaConhecida =
        $(".network-promo-grid").length > 0 || $(".network-promo-section").length > 0;

      if (!estruturaConhecida) {
        throw new ScrapingError(
          "Estrutura inesperada em /promocoes: nenhum elemento de campanha " +
            "(.network-promo-card) nem o container conhecido (.network-promo-grid) " +
            "foi encontrado. A origem provavelmente mudou de layout.",
        );
      }

      throw new ScrapingError(
        "Nenhuma campanha encontrada na listagem de promoções do União Supermercados.",
      );
    }

    const referencias: ReferenciaDeCampanha[] = [];
    const jaVistas = new Set<string>();

    cards.each((_, elemento) => {
      const card = $(elemento);

      const href =
        card.find("a.network-promo-card__cta").attr("href") ??
        card.find('a[href*="/promocoes/campanha/"]').attr("href");
      if (!href) {
        throw new ScrapingError(
          "Campanha sem link para a página de detalhe na listagem de /promocoes " +
            "(esperado a[href*='/promocoes/campanha/']).",
        );
      }

      const urlOrigem = this.urlAbsoluta(href);
      const identidade = /\/promocoes\/campanha\/([^/]+)\/([^/?#]+)/.exec(urlOrigem);
      if (!identidade) {
        throw new ScrapingError(
          `URL de campanha em formato inesperado: ${urlOrigem} ` +
            "(esperado /promocoes/campanha/{codigo}/{id}).",
        );
      }

      const nome = normalizarTexto(card.find(".network-promo-card__title").first().text());
      if (!nome) {
        throw new ScrapingError(
          `Campanha ${urlOrigem} sem nome (.network-promo-card__title) na listagem.`,
        );
      }

      const badge = normalizarTexto(card.find(".network-promo-card__badge").first().text());
      const metaTexto = normalizarTexto(
        card.find(".network-promo-card__meta").first().text() || card.text(),
      );
      const [dataInicio = null, dataFim = null] = extrairDatasISO(metaTexto);

      if (jaVistas.has(urlOrigem)) return;
      jaVistas.add(urlOrigem);

      referencias.push({
        codigoOrigem: identidade[1],
        idOrigem: identidade[2],
        nome,
        tipo: /rede/i.test(badge) || !badge ? "REDE" : "LOJA",
        dataInicio,
        dataFim,
        urlOrigem,
      });
    });

    return referencias;
  }

  private extrairProdutos(
    html: string,
    referencia: ReferenciaDeCampanha,
  ): ProdutoExtraido[] {
    const $ = cheerio.load(html);
    const linhas = $("ul.promo-campaign-offer-list > li");

    if (linhas.length === 0) {
      throw new ScrapingError(
        `Nenhum produto encontrado na campanha ${referencia.urlOrigem} ` +
          "(esperado ul.promo-campaign-offer-list > li). A origem pode ter mudado de layout.",
      );
    }

    const produtos: ProdutoExtraido[] = [];

    linhas.each((_, elemento) => {
      const linha = $(elemento);
      const plu = normalizarTexto(linha.find(".promo-campaign-offer-plu").first().text());
      const nome = normalizarTexto(linha.find(".promo-campaign-offer-name").first().text());
      const precoTexto = normalizarTexto(
        linha.find(".promo-campaign-offer-price").first().text(),
      );
      const preco = parsePrecoBrasileiro(precoTexto);

      if (!plu || !nome || preco === null) {
        throw new ScrapingError(
          `Produto incompleto na campanha ${referencia.urlOrigem} ` +
            `(plu="${plu}", nome="${nome}", preco="${precoTexto}"). ` +
            "Extração abortada para não persistir dado parcial como completo.",
        );
      }

      produtos.push({ plu, nome, preco });
    });

    return produtos;
  }
}

function mensagemDe(erro: unknown): string {
  if (erro instanceof Error) return erro.message;
  return String(erro);
}
