/**
 * Testes do scraper do União Supermercados (RF-1, RF-2, AC-3, AC-14).
 *
 * Contrato assumido (definido em design.md, seção 4.6): a classe
 * `UniaoSupermercadosScraper`, exportada por `../src/uniao-supermercados-scraper`,
 * implementa `MercadoScraper.scrape(): Promise<CampanhaExtraida[]>`.
 *
 * Estes testes NÃO dependem de rede: interceptam o `fetch` global e respondem
 * com fixtures HTML locais (algumas são cópia fiel das páginas reais
 * analisadas em 30/08/2026, outras são sintéticas para cobrir cenários de
 * borda). Nenhuma implementação existe ainda: espera-se que estes testes
 * falhem, por asserção, até a etapa de implementação.
 *
 * Nota sobre como este arquivo falha antes da implementação existir: em vez de um
 * `import` estático de `../src/uniao-supermercados-scraper` no topo do arquivo (que
 * derrubaria a COLETA do arquivo inteiro no Vitest, reportando "0 test" e um único
 * erro de carregamento por arquivo, escondendo os casos individuais), o módulo é
 * importado dinamicamente dentro de `beforeAll`. Assim a coleta funciona normalmente
 * — todo `it()` abaixo é registrado — e cada teste falha individualmente, por
 * asserção, com mensagem clara.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let UniaoSupermercadosScraper: new (...args: any[]) => { scrape(): Promise<any> };
let moduleLoadError: unknown = null;

beforeAll(async () => {
  try {
    // @ts-expect-error - módulo de produção ainda não existe; este teste define o contrato esperado.
    const mod = await import("../src/uniao-supermercados-scraper");
    UniaoSupermercadosScraper = mod.UniaoSupermercadosScraper;
  } catch (error) {
    moduleLoadError = error;
  }
});

function assertProducaoImplementada() {
  expect(
    moduleLoadError,
    "módulo de produção ../src/uniao-supermercados-scraper ainda não existe (esperado nesta fase de TDD; a implementação deve fazer este teste passar)",
  ).toBeNull();
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf-8");
}

const BASE_URL = "https://www.uniaosupermercados.com";

function stubSite(routes: Record<string, string | null>) {
  const fetchMock = vi.fn(async (input: string | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [path, html] of Object.entries(routes)) {
      if (url === `${BASE_URL}${path}`) {
        if (html === null) {
          return new Response("not found", { status: 404 });
        }
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    }
    throw new Error(`URL inesperada chamada pelo scraper: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("UniaoSupermercadosScraper", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("extrai a campanha e todos os seus produtos a partir das páginas reais analisadas (RF-1, RF-2)", async () => {
    assertProducaoImplementada();
    stubSite({
      "/promocoes": fixture("promocoes-listing.html"),
      "/promocoes/campanha/00000000000000/9066": fixture(
        "campanha-detalhe-9066.html",
      ),
    });

    const scraper = new UniaoSupermercadosScraper();
    const campanhas = await scraper.scrape();

    expect(campanhas).toHaveLength(1);
    const campanha = campanhas[0];

    expect(campanha.nome).toBe("FIM DE SEMANA");
    expect(campanha.tipo).toBe("REDE");
    expect(campanha.dataInicio).toBe("2026-08-28");
    expect(campanha.dataFim).toBe("2026-08-31");
    expect(campanha.urlOrigem).toBe(
      `${BASE_URL}/promocoes/campanha/00000000000000/9066`,
    );

    // A página real analisada tem 52 produtos; nenhum pode ser perdido no parsing.
    expect(campanha.produtos).toHaveLength(52);

    const primeiroProduto = campanha.produtos.find(
      (p: { plu: string }) => p.plu === "1046772",
    );
    expect(primeiroProduto).toEqual(
      expect.objectContaining({
        plu: "1046772",
        nome: "ACAI ORIGEM 1,5L",
        preco: 15.99,
      }),
    );

    const ultimoProduto = campanha.produtos.find(
      (p: { plu: string }) => p.plu === "1086243",
    );
    expect(ultimoProduto).toEqual(
      expect.objectContaining({
        plu: "1086243",
        nome: "SUCO ONLY 900ML UVA",
        preco: 8.99,
      }),
    );
  });

  it("percorre TODAS as campanhas listadas, não apenas a primeira (RF-1, AC-3)", async () => {
    assertProducaoImplementada();
    stubSite({
      "/promocoes": fixture("promocoes-listing-multiplas-campanhas.html"),
      "/promocoes/campanha/00000000000000/9066": fixture(
        "campanha-detalhe-9066.html",
      ),
      "/promocoes/campanha/00000000000000/9067": fixture(
        "campanha-detalhe-9067.html",
      ),
    });

    const scraper = new UniaoSupermercadosScraper();
    const campanhas = await scraper.scrape();

    expect(campanhas).toHaveLength(2);

    const nomes = campanhas.map((c: { nome: string }) => c.nome).sort();
    expect(nomes).toEqual(["FIM DE SEMANA", "SEGUNDA CAMPANHA"]);

    const segunda = campanhas.find(
      (c: { nome: string }) => c.nome === "SEGUNDA CAMPANHA",
    );
    expect(segunda.produtos).toHaveLength(3);
    expect(segunda.produtos.map((p: { plu: string }) => p.plu).sort()).toEqual(
      ["2000001", "2000002", "2000003"],
    );
    expect(segunda.urlOrigem).toBe(
      `${BASE_URL}/promocoes/campanha/00000000000000/9067`,
    );
  });

  it("inclui a URL de origem de cada campanha extraída (RF-2)", async () => {
    assertProducaoImplementada();
    stubSite({
      "/promocoes": fixture("promocoes-listing.html"),
      "/promocoes/campanha/00000000000000/9066": fixture(
        "campanha-detalhe-9066.html",
      ),
    });

    const scraper = new UniaoSupermercadosScraper();
    const [campanha] = await scraper.scrape();

    expect(campanha.urlOrigem).toMatch(/^https:\/\/www\.uniaosupermercados\.com\/promocoes\/campanha\//);
  });

  it("falha de forma descritiva quando a listagem não tem nenhuma campanha (AC-14)", async () => {
    assertProducaoImplementada();
    stubSite({
      "/promocoes": fixture("promocoes-listing-sem-campanhas.html"),
    });

    const scraper = new UniaoSupermercadosScraper();

    await expect(scraper.scrape()).rejects.toThrow(/campanha/i);
  });

  it("falha de forma descritiva quando a estrutura do HTML mudou de forma inesperada (AC-14)", async () => {
    assertProducaoImplementada();
    stubSite({
      "/promocoes": fixture("promocoes-listing-estrutura-alterada.html"),
    });

    const scraper = new UniaoSupermercadosScraper();

    await expect(scraper.scrape()).rejects.toThrow();
  });

  it("nao retorna sucesso parcial silencioso: se uma pagina de detalhe falhar, o erro se propaga (AC-14)", async () => {
    assertProducaoImplementada();
    stubSite({
      "/promocoes": fixture("promocoes-listing.html"),
      "/promocoes/campanha/00000000000000/9066": null,
    });

    const scraper = new UniaoSupermercadosScraper();

    await expect(scraper.scrape()).rejects.toThrow();
  });
});
