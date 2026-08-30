/**
 * Servidor HTTP local que simula o site público do União Supermercados para
 * os testes de integração da API. Os testes NUNCA devem acessar
 * https://www.uniaosupermercados.com de verdade: isso tornaria a suíte
 * dependente de rede e do conteúdo real do site mudar ao longo do tempo
 * (proibido pelo papel de Engenheiro de Testes: "nada de dependência de
 * rede, a menos que seja exatamente isso que está sendo testado").
 *
 * Contrato assumido: o scraper/orquestrador do União Supermercados lê a URL
 * base do mercado a partir de configuração (não hardcoded), permitindo que
 * o teste aponte para este mock em vez do site real.
 */
import { createServer, type Server } from "node:http";

export interface MockMercadoSite {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startMockMercadoSite(
  routes: Record<string, { status: number; html: string } | undefined>,
): Promise<MockMercadoSite> {
  const server: Server = createServer((req, res) => {
    const route = req.url ? routes[req.url] : undefined;
    if (!route) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<html><body>not found</body></html>");
      return;
    }
    res.writeHead(route.status, { "content-type": "text/html; charset=utf-8" });
    res.end(route.html);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Não foi possível determinar a porta do mock do site do mercado");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
