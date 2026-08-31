import { buildApp } from "./app.js";
import { prisma } from "./db.js";

const PORTA = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = await buildApp();

for (const sinal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinal, async () => {
    app.log.info({ sinal }, "encerrando a API");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

try {
  await app.listen({ port: PORTA, host: HOST });
} catch (erro) {
  app.log.error(erro, "falha ao iniciar a API");
  process.exit(1);
}
