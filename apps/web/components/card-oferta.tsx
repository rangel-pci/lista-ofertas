import type { Oferta } from "../lib/api";
import { formatarData, formatarPeriodo, formatarPreco } from "../lib/formato";

/** Card de oferta (AC-13): produto, preço, mercado e campanha/período. */
export function CardOferta({ oferta }: { oferta: Oferta }) {
  const periodo = formatarPeriodo(oferta.campanha.dataInicio, oferta.campanha.dataFim);
  const capturadoEm = formatarData(oferta.capturadoEm);

  return (
    <li
      data-testid="card-oferta"
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h2
          data-testid="card-oferta-nome"
          className="min-w-0 break-words text-sm font-semibold leading-snug text-slate-900"
        >
          {oferta.nomeProduto}
        </h2>
        <p
          data-testid="card-oferta-preco"
          className="shrink-0 whitespace-nowrap text-lg font-bold text-marca"
        >
          {formatarPreco(oferta.preco)}
        </p>
      </div>

      <dl className="mt-2 space-y-1 text-xs text-slate-600">
        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">Mercado:</dt>
          <dd data-testid="card-oferta-mercado" className="min-w-0 break-words">
            {oferta.mercado.nome}
          </dd>
        </div>

        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">Campanha:</dt>
          <dd data-testid="card-oferta-campanha" className="min-w-0 break-words">
            {oferta.campanha.nome}
            {periodo ? ` (${periodo})` : ""}
          </dd>
        </div>

        {oferta.cidade ? (
          <div className="flex flex-wrap gap-x-1">
            <dt className="font-medium">Cidade:</dt>
            <dd data-testid="card-oferta-cidade">{oferta.cidade}</dd>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-x-1">
          <dt className="font-medium">PLU:</dt>
          <dd>{oferta.plu}</dd>
        </div>

        {capturadoEm ? (
          <div className="flex flex-wrap gap-x-1">
            <dt className="font-medium">Capturado em:</dt>
            <dd>{capturadoEm}</dd>
          </div>
        ) : null}
      </dl>

      <a
        href={oferta.campanha.urlOrigem}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-block text-xs font-medium text-marca underline"
      >
        Ver na origem
      </a>
    </li>
  );
}
