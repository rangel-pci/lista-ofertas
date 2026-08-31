"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ORDENACOES, type Mercado } from "../lib/api";

const DEBOUNCE_BUSCA_MS = 400;

export interface FiltrosOfertasProps {
  mercados: Mercado[];
  /** Vem vazio quando nenhuma oferta do resultado tem cidade associável (AC-9). */
  cidades: string[];
  valores: {
    mercado: string;
    cidade: string;
    produto: string;
    dataInicio: string;
    dataFim: string;
    sort: string;
  };
}

/**
 * Controles de filtro e ordenação (RF-6/RF-7).
 *
 * O estado vive na query string: o link filtrado é compartilhável e a listagem
 * é renderizada no servidor a partir dele. Em telas estreitas o painel de
 * filtros pode ser recolhido, mas a busca e a ordenação ficam sempre visíveis,
 * porque são os controles de uso mais frequente.
 */
export function FiltrosOfertas({ mercados, cidades, valores }: FiltrosOfertasProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [painelAberto, setPainelAberto] = useState(true);
  const [busca, setBusca] = useState(valores.produto);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  function aplicar(alteracoes: Record<string, string>) {
    const parametros = new URLSearchParams(searchParams.toString());

    for (const [chave, valor] of Object.entries(alteracoes)) {
      if (valor) parametros.set(chave, valor);
      else parametros.delete(chave);
    }
    parametros.delete("page");

    const query = parametros.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function aoDigitarBusca(valor: string) {
    setBusca(valor);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => aplicar({ produto: valor }), DEBOUNCE_BUSCA_MS);
  }

  const temFiltroAtivo = Boolean(
    valores.mercado || valores.cidade || valores.dataInicio || valores.dataFim || busca,
  );

  return (
    <section aria-label="Busca e filtros de ofertas" className="w-full space-y-3">
      <div className="space-y-2">
        <label className="sr-only" htmlFor="busca-produto">
          Buscar produto
        </label>
        <input
          id="busca-produto"
          type="search"
          inputMode="search"
          placeholder="Buscar produto (ex.: acai)"
          aria-label="Buscar produto"
          data-testid="busca-produto"
          value={busca}
          onChange={(evento) => aoDigitarBusca(evento.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-marca focus:ring-2 focus:ring-marca/30"
        />

        <div className="flex w-full items-end gap-2">
          <div className="min-w-0 flex-1">
            <label
              className="mb-1 block text-xs font-medium text-slate-600"
              htmlFor="ordenacao"
            >
              Ordenar por
            </label>
            <select
              id="ordenacao"
              data-testid="ordenacao"
              value={valores.sort || "recentes"}
              onChange={(evento) => aplicar({ sort: evento.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm shadow-sm outline-none focus:border-marca"
            >
              {ORDENACOES.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setPainelAberto((aberto) => !aberto)}
            aria-expanded={painelAberto}
            aria-controls="painel-filtros"
            className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
          >
            Filtros
          </button>
        </div>
      </div>

      <div
        id="painel-filtros"
        data-testid="filtros"
        hidden={!painelAberto}
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm xs:grid-cols-2"
      >
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="filtro-mercado">
            Mercado
          </label>
          <select
            id="filtro-mercado"
            data-testid="filtro-mercado"
            value={valores.mercado}
            onChange={(evento) => aplicar({ mercado: evento.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">Todos os mercados</option>
            {mercados.map((mercado) => (
              <option key={mercado.slug} value={mercado.slug}>
                {mercado.nome}
              </option>
            ))}
          </select>
        </div>

        {cidades.length > 0 ? (
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="filtro-cidade">
              Cidade
            </label>
            <select
              id="filtro-cidade"
              data-testid="filtro-cidade"
              value={valores.cidade}
              onChange={(evento) => aplicar({ cidade: evento.target.value })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
            >
              <option value="">Todas as cidades</option>
              {cidades.map((cidade) => (
                <option key={cidade} value={cidade}>
                  {cidade}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="data-inicio">
            Vigência a partir de
          </label>
          <input
            id="data-inicio"
            type="date"
            data-testid="filtro-data-inicio"
            value={valores.dataInicio}
            onChange={(evento) => aplicar({ dataInicio: evento.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
        </div>

        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="data-fim">
            Vigência até
          </label>
          <input
            id="data-fim"
            type="date"
            data-testid="filtro-data-fim"
            value={valores.dataFim}
            onChange={(evento) => aplicar({ dataFim: evento.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          />
        </div>

        {temFiltroAtivo ? (
          <button
            type="button"
            onClick={() => {
              setBusca("");
              router.push(pathname, { scroll: false });
            }}
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 xs:col-span-2"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
    </section>
  );
}
