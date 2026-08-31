/**
 * Seed de catálogo (design.md, unidade de trabalho 2): registra o mercado
 * "União Supermercados". É idempotente, para poder rodar em qualquer banco
 * (desenvolvimento, teste, produção) sem duplicar nem perder dados de fato.
 *
 * Registrar um novo mercado é acrescentar um item em MERCADOS e um adapter
 * `MercadoScraper` correspondente (RF-8 / AC-15). Nenhuma alteração de schema
 * nem de registros já existentes é necessária.
 */
import { PrismaClient } from "@prisma/client";

const MERCADOS = [
  {
    slug: "uniao-supermercados",
    nome: "União Supermercados",
    urlBase: "https://www.uniaosupermercados.com",
    ativo: true,
  },
];

const prisma = new PrismaClient();

try {
  for (const mercado of MERCADOS) {
    await prisma.mercado.upsert({
      where: { slug: mercado.slug },
      update: { nome: mercado.nome, urlBase: mercado.urlBase, ativo: mercado.ativo },
      create: mercado,
    });
    console.log(`[seed] mercado "${mercado.slug}" pronto`);
  }
} finally {
  await prisma.$disconnect();
}
