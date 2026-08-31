import {
  UNIAO_SUPERMERCADOS_SLUG,
  UniaoSupermercadosScraper,
  type MercadoScraper,
} from "@lista-ofertas/scraping";

/**
 * Registro de adapters de scraping por mercado (ADR-5).
 *
 * Cadastrar um novo mercado é: inserir a linha em `Mercado` (seed) e acrescentar
 * uma entrada aqui. Nem o schema nem os dados de mercados existentes mudam
 * (RF-8 / AC-15). A URL base vem da própria linha do mercado, então nenhum
 * host fica hardcoded no código de orquestração.
 */
export interface MercadoRegistrado {
  slug: string;
  urlBase: string;
}

type FabricaDeScraper = (mercado: MercadoRegistrado) => MercadoScraper;

const REGISTRO: Record<string, FabricaDeScraper> = {
  [UNIAO_SUPERMERCADOS_SLUG]: (mercado) =>
    new UniaoSupermercadosScraper({ baseUrl: mercado.urlBase }),
};

export function temScraperRegistrado(slug: string): boolean {
  return Object.hasOwn(REGISTRO, slug);
}

export function slugsComScraper(): string[] {
  return Object.keys(REGISTRO);
}

export function criarScraper(mercado: MercadoRegistrado): MercadoScraper {
  const fabrica = REGISTRO[mercado.slug];
  if (!fabrica) {
    throw new Error(
      `Mercado "${mercado.slug}" não tem scraper registrado. ` +
        `Mercados com scraper: ${slugsComScraper().join(", ") || "(nenhum)"}.`,
    );
  }
  return fabrica(mercado);
}
