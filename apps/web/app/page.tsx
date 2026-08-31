import { CardOferta } from "../components/card-oferta";
import { FiltrosOfertas } from "../components/filtros-ofertas";
import {
  buscarCidades,
  buscarMercados,
  buscarOfertas,
  montarQueryString,
} from "../lib/api";

// A listagem depende sempre do estado atual do banco e da query string.
export const dynamic = "force-dynamic";

type ParametrosDeBusca = Record<string, string | string[] | undefined>;

function primeiro(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function PaginaDeOfertas({
  searchParams,
}: {
  searchParams: ParametrosDeBusca;
}) {
  const filtros = {
    mercado: primeiro(searchParams.mercado),
    cidade: primeiro(searchParams.cidade),
    produto: primeiro(searchParams.produto),
    dataInicio: primeiro(searchParams.dataInicio),
    dataFim: primeiro(searchParams.dataFim),
    sort: primeiro(searchParams.sort),
    page: primeiro(searchParams.page),
  };

  const [pagina, mercados, cidades] = await Promise.all([
    buscarOfertas(filtros),
    buscarMercados(),
    buscarCidades(),
  ]);

  const linkDaPagina = (numero: number) =>
    `/${montarQueryString({ ...filtros, page: String(numero) })}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-3 pb-10 pt-4">
      <header className="mb-4">
        <h1 className="text-xl font-bold leading-tight text-slate-900">
          Ofertas de supermercados
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Promoções mineradas das páginas públicas dos mercados cadastrados.
        </p>
      </header>

      <FiltrosOfertas
        mercados={mercados}
        cidades={cidades}
        valores={{
          mercado: filtros.mercado,
          cidade: filtros.cidade,
          produto: filtros.produto,
          dataInicio: filtros.dataInicio,
          dataFim: filtros.dataFim,
          sort: filtros.sort,
        }}
      />

      <p className="mb-2 mt-4 text-xs text-slate-500" data-testid="resumo-resultado">
        {pagina.total === 1 ? "1 oferta encontrada" : `${pagina.total} ofertas encontradas`}
      </p>

      <ul
        data-testid="lista-ofertas"
        aria-label="Ofertas"
        className="grid w-full grid-cols-1 gap-3 xs:grid-cols-2"
      >
        {pagina.items.length === 0 ? (
          <li
            data-testid="estado-vazio"
            className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 xs:col-span-2"
          >
            Nenhuma oferta encontrada para os filtros escolhidos.
          </li>
        ) : (
          pagina.items.map((oferta) => <CardOferta key={oferta.id} oferta={oferta} />)
        )}
      </ul>

      {pagina.totalPages > 1 ? (
        <nav aria-label="Paginação" className="mt-4 flex items-center justify-between gap-2">
          {pagina.page > 1 ? (
            <a
              href={linkDaPagina(pagina.page - 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
            >
              Anterior
            </a>
          ) : (
            <span />
          )}

          <span className="text-xs text-slate-500">
            Página {pagina.page} de {pagina.totalPages}
          </span>

          {pagina.page < pagina.totalPages ? (
            <a
              href={linkDaPagina(pagina.page + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
            >
              Próxima
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
