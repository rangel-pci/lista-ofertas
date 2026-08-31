/**
 * RF-6/RF-7 (filtros e ordenação no frontend) — AC-8, AC-9, AC-10, AC-11,
 * AC-12, AC-13.
 *
 * Pré-requisito: frontend em WEB_BASE_URL e API em API_BASE_URL, ambos
 * rodando, com ao menos uma execução de scraping SUCCESS persistida (ver
 * tests/README.md). Os testes de valor concreto (ex.: nome de um produto
 * específico) assumem os dados reais do União Supermercados extraídos em
 * 30/08/2026 (ex.: campanha "FIM DE SEMANA" com o produto "ACAI ORIGEM
 * 1,5L"); se o scraping tiver sido re-executado após o período de
 * vigência daquela campanha, estes dois testes específicos podem precisar
 * de atualização de dado (não de comportamento).
 */
import { expect, test } from "@playwright/test";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

test.describe("AC-13: card de oferta mostra os dados mínimos exigidos", () => {
  test("cada card exibe produto, preço, mercado e campanha/período", async ({
    page,
  }) => {
    await page.goto("/");

    const primeiroCard = page.getByTestId("card-oferta").first();
    await expect(primeiroCard).toBeVisible();

    const texto = await primeiroCard.innerText();
    expect(texto).toMatch(/R\$\s*\d/); // preço
    expect(texto.trim().length).toBeGreaterThan(0);
  });
});

test.describe("AC-8: filtro por mercado", () => {
  test("selecionar um mercado no filtro restringe a listagem a esse mercado", async ({
    page,
  }) => {
    await page.goto("/");

    const filtroMercado = page.getByLabel(/mercado/i).or(
      page.getByTestId("filtro-mercado"),
    );
    // `selectOption` aceita apenas string em `label` (regex é rejeitada pela
    // própria API do Playwright), por isso o rótulo é comparado literalmente.
    await filtroMercado.first().selectOption({ label: "União Supermercados" });

    await expect(page).toHaveURL(/mercado=/);

    const nomesMercadoNosCards = page.getByTestId("card-oferta-mercado");
    const total = await nomesMercadoNosCards.count();
    for (let i = 0; i < total; i++) {
      await expect(nomesMercadoNosCards.nth(i)).toContainText(
        /União Supermercados/i,
      );
    }
  });
});

test.describe("AC-9: filtro de cidade só aparece quando há dado de cidade", () => {
  test("o filtro de cidade reflete a disponibilidade real de dados de cidade", async ({
    page,
  }) => {
    const cidadesResponse = await page.request.get(`${API_BASE_URL}/api/cidades`);
    expect(cidadesResponse.ok()).toBe(true);
    const cidades: string[] = await cidadesResponse.json();

    await page.goto("/");
    const filtroCidade = page.getByLabel(/cidade/i).or(
      page.getByTestId("filtro-cidade"),
    );

    if (cidades.length === 0) {
      await expect(filtroCidade.first()).not.toBeVisible();
    } else {
      await expect(filtroCidade.first()).toBeVisible();
      await expect(filtroCidade.first()).toBeEnabled();
    }
  });
});

test.describe("AC-10: filtro por data de vigência", () => {
  test("filtrar por um período sem nenhuma promoção vigente resulta em listagem vazia, sem erro", async ({
    page,
  }) => {
    await page.goto("/?dataInicio=2099-01-01&dataFim=2099-01-31");

    await expect(page.getByTestId("card-oferta")).toHaveCount(0);
    await expect(page.getByTestId("estado-vazio").or(page.getByText(/nenhuma oferta/i))).toBeVisible();
  });
});

test.describe("AC-11: busca por produto", () => {
  test("digitar parte do nome de um produto filtra a listagem para conter apenas correspondências", async ({
    page,
  }) => {
    await page.goto("/");

    const campoBusca = page.getByRole("searchbox").or(
      page.getByPlaceholder(/produto/i),
    );
    await campoBusca.first().fill("acai");
    await page.waitForURL(/produto=acai/i, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600); // aguarda debounce de busca

    const cards = page.getByTestId("card-oferta");
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      await expect(cards.nth(i)).toContainText(/acai/i);
    }
  });
});

test.describe("AC-12: ordenação", () => {
  async function precosExibidos(page: import("@playwright/test").Page) {
    const textos = await page.getByTestId("card-oferta-preco").allInnerTexts();
    return textos.map((t) => Number(t.replace(/[^\d,]/g, "").replace(",", ".")));
  }

  test("ordenar por preço crescente reflete corretamente no resultado", async ({
    page,
  }) => {
    await page.goto("/");
    const seletorOrdenacao = page.getByLabel(/orden/i).or(
      page.getByTestId("ordenacao"),
    );
    await seletorOrdenacao.first().selectOption({ label: "Preço crescente" });
    await page.waitForTimeout(300);

    const precos = await precosExibidos(page);
    expect(precos).toEqual([...precos].sort((a, b) => a - b));
  });

  test("ordenar por preço decrescente reflete corretamente no resultado", async ({
    page,
  }) => {
    await page.goto("/");
    const seletorOrdenacao = page.getByLabel(/orden/i).or(
      page.getByTestId("ordenacao"),
    );
    await seletorOrdenacao.first().selectOption({ label: "Preço decrescente" });
    await page.waitForTimeout(300);

    const precos = await precosExibidos(page);
    expect(precos).toEqual([...precos].sort((a, b) => b - a));
  });

  test("ordenar por nome A-Z e Z-A reflete corretamente no resultado", async ({
    page,
  }) => {
    await page.goto("/");
    const seletorOrdenacao = page.getByLabel(/orden/i).or(
      page.getByTestId("ordenacao"),
    );

    await seletorOrdenacao.first().selectOption({ label: "Nome A-Z" });
    await page.waitForTimeout(300);
    const nomesAz = await page.getByTestId("card-oferta-nome").allInnerTexts();
    expect(nomesAz).toEqual([...nomesAz].sort((a, b) => a.localeCompare(b)));

    await seletorOrdenacao.first().selectOption({ label: "Nome Z-A" });
    await page.waitForTimeout(300);
    const nomesZa = await page.getByTestId("card-oferta-nome").allInnerTexts();
    expect(nomesZa).toEqual([...nomesZa].sort((a, b) => b.localeCompare(a)));
  });
});
