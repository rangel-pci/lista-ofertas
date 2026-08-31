import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma único do processo. `globalThis` é usado para sobreviver a
 * recarregamentos em desenvolvimento (`tsx watch`) sem abrir uma nova pool de
 * conexões a cada mudança de arquivo.
 */
const escopoGlobal = globalThis as unknown as { __listaOfertasPrisma?: PrismaClient };

export const prisma: PrismaClient =
  escopoGlobal.__listaOfertasPrisma ??
  new PrismaClient({
    log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  escopoGlobal.__listaOfertasPrisma = prisma;
}
