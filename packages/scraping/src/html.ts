/** Helpers de normalização de texto e de valores extraídos de HTML. */

export function normalizarTexto(valor: string | undefined | null): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Converte um preço em formato brasileiro ("R$ 1.234,56") para número.
 * Retorna `null` quando o texto não contém um valor numérico reconhecível,
 * para que o chamador decida se isso é falha de extração.
 */
export function parsePrecoBrasileiro(texto: string): number | null {
  const somenteNumero = normalizarTexto(texto).replace(/[^\d.,]/g, "");
  if (!somenteNumero) return null;

  const normalizado = somenteNumero.replace(/\./g, "").replace(",", ".");
  const valor = Number(normalizado);

  return Number.isFinite(valor) ? valor : null;
}

/** Extrai todas as datas `dd/mm/aaaa` de um texto, em formato ISO `aaaa-mm-dd`. */
export function extrairDatasISO(texto: string): string[] {
  const datas: string[] = [];
  const padrao = /(\d{2})\/(\d{2})\/(\d{4})/g;

  for (const match of normalizarTexto(texto).matchAll(padrao)) {
    const [, dia, mes, ano] = match;
    datas.push(`${ano}-${mes}-${dia}`);
  }

  return datas;
}
