# Testes — `packages/scraping`

Suíte escrita antes da implementação (papel de Engenheiro de Testes).
Cobre `UniaoSupermercadosScraper` (RF-1, RF-2), incluindo os casos de
borda de AC-14 (falha descritiva quando a estrutura do site muda ou não
há campanhas).

## Fixtures

| Arquivo | Origem | Uso |
|---|---|---|
| `promocoes-listing.html` | Cópia fiel de `https://www.uniaosupermercados.com/promocoes`, capturada em 30/08/2026 | Extração da campanha real "FIM DE SEMANA" |
| `campanha-detalhe-9066.html` | Cópia fiel de `.../promocoes/campanha/00000000000000/9066`, capturada em 30/08/2026 | Extração dos 52 produtos reais da campanha |
| `promocoes-listing-multiplas-campanhas.html` | Sintética | AC-3: garantir que TODAS as campanhas são percorridas, não só a primeira |
| `campanha-detalhe-9067.html` | Sintética | Detalhe da 2ª campanha do cenário acima |
| `promocoes-listing-sem-campanhas.html` | Sintética | AC-14: listagem sem nenhuma campanha deve falhar de forma descritiva |
| `promocoes-listing-estrutura-alterada.html` | Sintética | AC-14: mudança de estrutura do HTML deve falhar de forma descritiva, não retornar dados incompletos silenciosamente |

Nenhum teste desta suíte acessa a rede: todo `fetch` é interceptado
(`vi.stubGlobal`) para não depender da disponibilidade nem do conteúdo
atual do site de terceiro.

## Como rodar (quando a implementação existir)

```bash
npm run test --workspace @lista-ofertas/scraping
```
