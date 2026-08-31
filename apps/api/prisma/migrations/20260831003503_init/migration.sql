-- CreateEnum
CREATE TYPE "TipoCampanha" AS ENUM ('REDE', 'LOJA');

-- CreateEnum
CREATE TYPE "ScrapeRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "Mercado" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "urlBase" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mercado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loja" (
    "id" TEXT NOT NULL,
    "mercadoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "cidade" TEXT NOT NULL,
    "uf" TEXT,
    "cep" TEXT,
    "telefone" TEXT,
    "horario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campanha" (
    "id" TEXT NOT NULL,
    "mercadoId" TEXT NOT NULL,
    "codigoOrigem" TEXT NOT NULL,
    "idOrigem" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCampanha" NOT NULL,
    "lojaId" TEXT,
    "dataInicio" TIMESTAMP(3),
    "dataFim" TIMESTAMP(3),
    "urlOrigem" TEXT NOT NULL,
    "primeiraVistaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaVistaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campanha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "mercadoId" TEXT NOT NULL,
    "status" "ScrapeRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "stats" JSONB,

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfertaCapturada" (
    "id" TEXT NOT NULL,
    "scrapeRunId" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "mercadoId" TEXT NOT NULL,
    "plu" TEXT NOT NULL,
    "nomeProduto" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "capturadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfertaCapturada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mercado_slug_key" ON "Mercado"("slug");

-- CreateIndex
CREATE INDEX "Loja_mercadoId_idx" ON "Loja"("mercadoId");

-- CreateIndex
CREATE INDEX "Loja_cidade_idx" ON "Loja"("cidade");

-- CreateIndex
CREATE INDEX "Campanha_mercadoId_idx" ON "Campanha"("mercadoId");

-- CreateIndex
CREATE INDEX "Campanha_dataInicio_dataFim_idx" ON "Campanha"("dataInicio", "dataFim");

-- CreateIndex
CREATE UNIQUE INDEX "Campanha_mercadoId_codigoOrigem_idOrigem_key" ON "Campanha"("mercadoId", "codigoOrigem", "idOrigem");

-- CreateIndex
CREATE INDEX "ScrapeRun_mercadoId_status_startedAt_idx" ON "ScrapeRun"("mercadoId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "OfertaCapturada_scrapeRunId_idx" ON "OfertaCapturada"("scrapeRunId");

-- CreateIndex
CREATE INDEX "OfertaCapturada_mercadoId_plu_idx" ON "OfertaCapturada"("mercadoId", "plu");

-- CreateIndex
CREATE INDEX "OfertaCapturada_campanhaId_idx" ON "OfertaCapturada"("campanhaId");

-- CreateIndex
CREATE INDEX "OfertaCapturada_nomeProduto_idx" ON "OfertaCapturada"("nomeProduto");

-- CreateIndex
CREATE INDEX "OfertaCapturada_capturadoEm_idx" ON "OfertaCapturada"("capturadoEm");

-- AddForeignKey
ALTER TABLE "Loja" ADD CONSTRAINT "Loja_mercadoId_fkey" FOREIGN KEY ("mercadoId") REFERENCES "Mercado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campanha" ADD CONSTRAINT "Campanha_mercadoId_fkey" FOREIGN KEY ("mercadoId") REFERENCES "Mercado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campanha" ADD CONSTRAINT "Campanha_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapeRun" ADD CONSTRAINT "ScrapeRun_mercadoId_fkey" FOREIGN KEY ("mercadoId") REFERENCES "Mercado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaCapturada" ADD CONSTRAINT "OfertaCapturada_scrapeRunId_fkey" FOREIGN KEY ("scrapeRunId") REFERENCES "ScrapeRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaCapturada" ADD CONSTRAINT "OfertaCapturada_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "Campanha"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfertaCapturada" ADD CONSTRAINT "OfertaCapturada_mercadoId_fkey" FOREIGN KEY ("mercadoId") REFERENCES "Mercado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
