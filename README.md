# Lista de Ofertas

Mineração de promoções de supermercados e listagem pública das ofertas. O
sistema faz scraping das páginas públicas dos mercados cadastrados, guarda tudo
o que extrai (com histórico, sem sobrescrever execuções anteriores) e publica as
ofertas em um frontend mobile first, sem login.

Requisitos e arquitetura de referência: `.factory/artifacts/requirements.md` e
`.factory/artifacts/design.md`.

## Estrutura

```
apps/api        Serviço HTTP: webhook de sincronização, API pública de consulta, orquestração
apps/web        Frontend público mobile first (Next.js)
packages/scraping  Adapters de scraping por mercado (contrato MercadoScraper)
```

Primeiro mercado implementado: União Supermercados
(`https://www.uniaosupermercados.com`).

## Pré-requisitos

- Node.js 20 ou superior
- Docker (apenas para o Postgres local; qualquer Postgres 14+ serve)

## Como rodar

```bash
npm install
npm run db:up          # sobe o Postgres local em localhost:5432
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lista_ofertas"
export WEBHOOK_SECRET="uma-chave-forte"
npm run db:migrate     # aplica as migrations
npm run db:seed        # registra o mercado União Supermercados
npm run dev:api        # API em http://localhost:3001
npm run dev:web        # frontend em http://localhost:3000
```

Variáveis de ambiente estão documentadas em `.env.example`.

## Disparar a mineração

A execução do scraping é acionada por webhook autenticado por chave. A cadência
diária fica com quem chama o webhook (por exemplo, um cron externo).

```bash
# dispara a sincronização de todos os mercados ativos com scraper registrado
curl -X POST http://localhost:3001/api/scrape-runs \
  -H "x-webhook-key: $WEBHOOK_SECRET"
# -> 202 { "id": "<id da execução>", "runs": [...] }

# consulta o resultado da execução
curl http://localhost:3001/api/scrape-runs/<id>
# -> { "status": "SUCCESS" | "RUNNING" | "FAILED", "errorMessage": null, "stats": {...} }
```

Chamada sem a chave, ou com chave errada, responde `401` e nenhuma execução é
criada. Para minerar um mercado específico: `-d '{"mercado":"uniao-supermercados"}'`
com `content-type: application/json`.

## API pública de consulta

Sem autenticação.

| Rota | Descrição |
|---|---|
| `GET /api/ofertas` | Listagem paginada. Filtros: `mercado`, `cidade`, `produto`, `dataInicio`, `dataFim`, `capturadoDe`, `capturadoAte`. Ordenação em `sort`: `recentes`, `preco_asc`, `preco_desc`, `nome_asc`, `nome_desc`. Paginação: `page`, `pageSize`. |
| `GET /api/mercados` | Mercados cadastrados. |
| `GET /api/cidades` | Cidades associáveis às ofertas atuais. Lista vazia quando nenhuma oferta vem de campanha de loja. |
| `GET /api/scrape-runs` | Execuções recentes de scraping. |
| `GET /api/scrape-runs/:id` | Status e erro de uma execução. |

A listagem pública mostra apenas a última execução bem-sucedida de cada mercado,
enquanto o histórico completo permanece armazenado em `OfertaCapturada` (uma
linha por produto por campanha por execução, nunca atualizada nem apagada).

## Testes

```bash
npm test          # scraper + integração da API (sobe/prepara o banco de teste automaticamente)
npm run typecheck # TypeScript de apps/api, apps/web e packages/scraping
npm run test:e2e  # Playwright contra API e frontend já em execução
```

O banco de teste é `postgresql://postgres:postgres@localhost:5432/lista_ofertas_test`,
sobreponível por `TEST_DATABASE_URL`. Ele é deliberadamente independente de
`DATABASE_URL`: a suíte apaga linhas entre testes e não pode alcançar o banco de
desenvolvimento nem o de outro projeto por herança de variável de ambiente.

Para o E2E, suba a API e o frontend, garanta ao menos uma execução de scraping
bem-sucedida e informe `WEB_BASE_URL` e `API_BASE_URL` se as portas não forem as
padrão. Os navegadores do Playwright são instalados com `npx playwright install`.

## Cadastrar um novo mercado

1. Acrescente o mercado em `apps/api/prisma/seed.mjs` (slug, nome, URL base).
2. Implemente o adapter em `packages/scraping/src/` seguindo o contrato
   `MercadoScraper` e registre-o em `apps/api/src/scrapers/registry.ts`.

Nenhuma alteração de schema nem dos dados de mercados já existentes é
necessária.
