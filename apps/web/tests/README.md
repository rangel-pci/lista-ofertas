# Testes E2E — `apps/web`

Suíte Playwright escrita antes da implementação (papel de Engenheiro de
Testes). Cobre RF-5/RF-6/RF-7 (AC-6, AC-7, AC-8 a AC-13) a partir do
comportamento observável no navegador, não da implementação interna dos
componentes.

## Seletores assumidos (`data-testid`)

Como não há implementação ainda, os testes assumem os seguintes atributos
`data-testid` (ou fallback por papel/label ARIA) na UI a ser construída:

- `lista-ofertas`: contêiner da listagem de ofertas.
- `card-oferta`: cada card de oferta na listagem.
- `card-oferta-mercado`, `card-oferta-preco`, `card-oferta-nome`: campos
  dentro do card.
- `filtros`, `filtro-mercado`, `filtro-cidade`: controles de filtro.
- `ordenacao`: seletor de ordenação.
- `estado-vazio`: mensagem exibida quando a listagem filtrada não tem
  resultados.

Se a implementação preferir não usar `data-testid`, os testes também têm
fallback por `role`/`label` acessível (ex.: `getByRole("searchbox")`,
`getByLabel(/cidade/i)`). Ajustar os seletores para o padrão real da UI
não invalida os cenários e critérios de aceite cobertos; é refinamento de
implementação, não mudança de comportamento esperado.

## Como rodar (quando a implementação existir)

1. Suba banco + API + ao menos uma execução de scraping `SUCCESS`.
2. Suba o frontend (`npm run dev --workspace @lista-ofertas/web` ou
   equivalente).
3. Exporte `WEB_BASE_URL` (padrão `http://localhost:3000`) e
   `API_BASE_URL` (padrão `http://localhost:3001`) se diferentes do
   padrão.
4. `npx playwright install` (uma vez) e depois
   `npm run test:e2e --workspace @lista-ofertas/web`.
