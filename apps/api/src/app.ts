import cors from "@fastify/cors";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { ParametroInvalidoError } from "./ofertas.js";
import { consultaRoutes } from "./routes/consulta.js";
import { scrapeRunsRoutes } from "./routes/scrape-runs.js";
import { aguardarExecucoesEmAndamento } from "./scrape-runner.js";

export interface BuildAppOptions {
  logger?: boolean;
}

/**
 * Monta a aplicação sem abrir porta de rede, para permitir teste por injeção
 * (`app.inject`) além do uso real em `server.ts`.
 */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? process.env.NODE_ENV !== "test",
  });

  // A API é pública e sem login (AC-6): qualquer origem pode ler.
  await app.register(cors, { origin: true, methods: ["GET", "POST", "OPTIONS"] });

  app.setErrorHandler((erro: FastifyError, request, reply) => {
    if (erro instanceof ParametroInvalidoError) {
      return reply.code(400).send({ error: "Bad Request", message: erro.message });
    }

    request.log.error({ erro: erro.message }, "erro não tratado na requisição");
    const status = erro.statusCode && erro.statusCode >= 400 ? erro.statusCode : 500;

    return reply.code(status).send({
      error: status === 500 ? "Internal Server Error" : erro.name,
      message: status === 500 ? "Erro interno ao processar a requisição." : erro.message,
    });
  });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(scrapeRunsRoutes);
  await app.register(consultaRoutes);

  // Execuções de scraping rodam no processo (ADR-4): o encerramento espera o
  // que está em voo para não escrever em conexão já fechada.
  app.addHook("onClose", async () => {
    await aguardarExecucoesEmAndamento();
  });

  return app;
}
