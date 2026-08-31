const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarPreco(valor: number): string {
  return MOEDA.format(valor);
}

/** Converte `2026-08-28T00:00:00.000Z` em `28/08/2026`, sem deslocar o dia. */
export function formatarData(iso: string | null): string | null {
  if (!iso) return null;

  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;

  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");

  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

export function formatarPeriodo(inicio: string | null, fim: string | null): string | null {
  const de = formatarData(inicio);
  const ate = formatarData(fim);

  if (de && ate) return `${de} a ${ate}`;
  if (de) return `a partir de ${de}`;
  if (ate) return `até ${ate}`;

  return null;
}
