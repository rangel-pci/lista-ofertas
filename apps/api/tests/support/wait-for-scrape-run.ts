/**
 * O webhook dispara o scraping de forma assíncrona (design.md, ADR-4): a
 * resposta HTTP chega antes do fim da execução. Este helper faz polling em
 * `GET /api/scrape-runs/:id` até a execução saltar do estado RUNNING.
 */
export async function waitForScrapeRunCompletion(
  app: { inject: (opts: { method: "GET"; url: string }) => Promise<{ json(): any }> },
  id: string | number,
  timeoutMs = 15_000,
): Promise<{ status: string; errorMessage?: string | null }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response = await app.inject({
      method: "GET",
      url: `/api/scrape-runs/${id}`,
    });
    const body = response.json();
    if (body.status !== "RUNNING") {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Execução de scraping ${id} não saiu do estado RUNNING em ${timeoutMs}ms`,
  );
}
