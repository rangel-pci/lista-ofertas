# Testes de integração — `apps/api`

Suíte escrita antes da implementação (papel de Engenheiro de Testes). É
esperado que estes testes falhem até a etapa de implementação criar
`src/app.ts`, `src/db.ts` e o schema Prisma descritos em
`.factory/artifacts/design.md`.

`../src/app` e `../src/db` são importados dinamicamente dentro de
`beforeAll` (em vez de `import` estático no topo do arquivo) de propósito:
um `import` estático de um módulo inexistente derruba a coleta do arquivo
inteiro no Vitest (relatado como "0 test", um único erro de carregamento
por arquivo), escondendo os casos de teste individuais. Com import
dinâmico, cada `it()` é coletado normalmente e falha, individualmente, por
uma asserção com mensagem clara — o "vermelho" que o papel de Engenheiro
de Testes exige. Os helpers em `tests/support/test-db.ts` e
`tests/support/seed-ofertas.ts` recebem `prisma` por parâmetro pelo mesmo
motivo, em vez de importá-lo.

Para rodar esta suíte junto com `packages/scraping` em uma única execução
(gerando também o relatório JUnit em `.factory/reports/junit.xml`), use
`npm test` a partir da raiz do repositório. Rodar apenas este pacote:
`npm run test --workspace @lista-ofertas/api` (não inclui o relatório
JUnit consolidado).

## Cenários cobertos

| Arquivo | Critérios de aceite |
|---|---|
| `webhook.test.ts` | AC-1, AC-2, AC-14 (status consultável) |
| `scrape-history.test.ts` | AC-3, AC-4, AC-5, AC-13 (ADR-3, listagem sem duplicar histórico), AC-14, AC-15 |
| `ofertas-query.test.ts` | AC-8, AC-9, AC-10, AC-11, AC-12, AC-13 |

## Como rodar (quando a implementação existir)

1. Suba um Postgres de teste (pode reusar o Docker Compose de
   desenvolvimento com outro nome de banco):

   ```bash
   docker run --rm -d --name lista-ofertas-test-db -p 5432:5432 \
     -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lista_ofertas_test postgres:16
   ```

2. Aplique as migrations e o seed do mercado União Supermercados nesse
   banco (`prisma migrate deploy` + script de seed, conforme a unidade de
   trabalho 2 do design).
3. Exporte `DATABASE_URL` apontando para esse banco (o valor padrão usado
   pelos testes é `postgresql://postgres:postgres@localhost:5432/lista_ofertas_test`,
   ajustável via variável de ambiente).
4. `npm run test --workspace @lista-ofertas/api`.

## Por que não usamos o site real do União Supermercados nos testes

Os testes de `scrape-history.test.ts` disparam o scraper de ponta a ponta,
mas contra um servidor HTTP local (`tests/support/mock-mercado-site.ts`)
que serve fixtures HTML fixas, apontando `Mercado.urlBase` para esse mock
antes de cada cenário. Isso evita que a suíte:

- dependa de rede/disponibilidade do site de terceiro;
- fique flaky ou desatualizada quando o site real mudar de conteúdo.

Os testes de extração de HTML propriamente ditos (parsing) ficam em
`packages/scraping/tests`, incluindo fixtures que são cópia fiel das
páginas reais analisadas em 30/08/2026.
