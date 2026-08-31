/**
 * RF-5 (frontend público mobile-first) — AC-6 e AC-7.
 *
 * Pré-requisito: frontend rodando em WEB_BASE_URL (padrão
 * http://localhost:3000) com API e banco disponíveis e ao menos uma
 * execução de scraping SUCCESS já persistida (ver tests/README.md).
 */
import { expect, test } from "@playwright/test";

test.describe("AC-6: acesso público, sem login", () => {
  test("a página inicial de ofertas carrega sem exigir login ou cadastro", async ({
    page,
  }) => {
    const response = await page.goto("/");
    expect(response?.ok()).toBe(true);

    // Nenhum indício de exigência de autenticação: sem campo de senha,
    // sem redirecionamento para rota de login.
    expect(page.url()).not.toMatch(/login|signin|entrar/i);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});

test.describe("AC-7: usabilidade em viewport estreita (até 480px)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const { width } = testInfo.project.use.viewport ?? { width: 1280 };
    test.skip(width > 480, "Este cenário só se aplica a viewports até 480px");
    await page.goto("/");
  });

  test("não há rolagem horizontal na página", async ({ page }) => {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("a listagem de ofertas é visível e utilizável", async ({ page }) => {
    const listaDeOfertas = page.getByTestId("lista-ofertas").or(
      page.getByRole("list", { name: /ofertas/i }),
    );
    await expect(listaDeOfertas.first()).toBeVisible();

    const box = await listaDeOfertas.first().boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    if (box && viewport) {
      expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  });

  test("os controles de filtro e ordenação estão visíveis e acessíveis sem elementos cortados", async ({
    page,
  }) => {
    const filtros = page.getByRole("button", { name: /filtr/i }).or(
      page.getByTestId("filtros"),
    );
    const ordenacao = page.getByRole("combobox", { name: /orden/i }).or(
      page.getByTestId("ordenacao"),
    );

    await expect(filtros.first()).toBeVisible();
    await expect(ordenacao.first()).toBeVisible();

    const viewport = page.viewportSize();
    for (const controle of [filtros.first(), ordenacao.first()]) {
      const box = await controle.boundingBox();
      expect(box).not.toBeNull();
      if (box && viewport) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    }
  });
});
