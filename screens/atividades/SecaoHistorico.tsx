import { useId } from 'react';
import Icone from '@/components/ui/Icone';
import {
  descreverAcaoEvento,
  descreverAutorEvento,
  formatarValorHistorico,
} from '@/screens/atividades/descricaoHistorico';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import type { AlteracaoHistorico } from '@/servidor/historico/historicoRepositorio';
import type { ConsultaHistorico } from '@/servidor/historico/consultasHistorico';
import { formatarInstanteParaExibicao } from '@/util/DataUtils';

const CLASSES_TEXTO_DESCRICAO =
  'max-h-60 overflow-auto rounded-md border border-borda bg-fundo p-2 text-xs break-words whitespace-pre-wrap';

function AlteracaoDescricao({ alteracao }: { alteracao: AlteracaoHistorico }) {
  return (
    <li>
      <details>
        <summary className="cursor-pointer text-texto">
          {textosAtividades.descricaoAlterada}
          <span className="ml-1 text-texto-suave">
            ({textosAtividades.verDescricaoAnterior})
          </span>
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-semibold">
              {textosAtividades.descricaoAntes}
            </span>
            <p className={CLASSES_TEXTO_DESCRICAO}>
              {alteracao.antes ?? textosAtividades.valorVazioHistorico}
            </p>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-semibold">
              {textosAtividades.descricaoDepois}
            </span>
            <p className={CLASSES_TEXTO_DESCRICAO}>
              {alteracao.depois ?? textosAtividades.valorVazioHistorico}
            </p>
          </div>
        </div>
      </details>
    </li>
  );
}

function ListaAlteracoes({
  alteracoes,
}: {
  alteracoes: readonly AlteracaoHistorico[];
}) {
  const campos = alteracoes.filter((alteracao) => alteracao.campo !== 'anexo');
  if (campos.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-col gap-1 text-xs text-texto-suave">
      {campos.map((alteracao) =>
        alteracao.campo === 'descricao' ? (
          <AlteracaoDescricao key={alteracao.campo} alteracao={alteracao} />
        ) : (
          <li key={alteracao.campo} className="break-words">
            {textosAtividades.descreverAlteracaoHistorico(
              textosAtividades.camposHistorico[alteracao.campo],
              formatarValorHistorico(alteracao.campo, alteracao.antes),
              formatarValorHistorico(alteracao.campo, alteracao.depois),
            )}
          </li>
        ),
      )}
    </ul>
  );
}

type PropriedadesSecaoHistorico = {
  historico: ConsultaHistorico;
  fusoHorario: string;
  // Nome do link ou do token de quem alterou: só o administrador vê.
  exibirAutor: boolean;
};

// Recolhido por padrão, para não empurrar os anexos para baixo; o número de
// registros fica no resumo.
export default function SecaoHistorico({
  historico,
  fusoHorario,
  exibirAutor,
}: PropriedadesSecaoHistorico) {
  const idTitulo = useId();
  const { eventos, total } = historico;
  return (
    <section aria-labelledby={idTitulo}>
      <details className="group rounded-lg border border-borda">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-fundo focus-visible:outline-2 focus-visible:outline-primaria [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <Icone nome="historico" className="text-texto-suave" />
            <h2 id={idTitulo} className="text-sm font-semibold">
              {textosAtividades.rotuloHistorico}
            </h2>
          </span>
          <span className="flex items-center gap-1 text-xs text-texto-suave">
            {textosAtividades.resumoHistorico(total)}
            <Icone
              nome="setaBaixo"
              className="size-4 transition-transform group-open:rotate-180"
            />
          </span>
        </summary>
        <div className="border-t border-borda px-3 py-2">
          {eventos.length === 0 ? (
            <p className="py-1 text-sm text-texto-suave">
              {textosAtividades.semHistorico}
            </p>
          ) : (
            <ol className="flex flex-col divide-y divide-borda">
              {eventos.map((evento) => (
                <li key={evento.id} className="flex flex-col gap-1 py-2">
                  <p className="text-sm break-words">
                    <span className="font-semibold">
                      {descreverAutorEvento(evento, exibirAutor)}
                    </span>{' '}
                    {descreverAcaoEvento(evento)}
                    <span className="text-texto-suave">
                      {' · '}
                      <time dateTime={evento.ocorridoEm}>
                        {formatarInstanteParaExibicao(
                          evento.ocorridoEm,
                          fusoHorario,
                        )}
                      </time>
                    </span>
                  </p>
                  <ListaAlteracoes alteracoes={evento.alteracoes} />
                </li>
              ))}
            </ol>
          )}
          {total > eventos.length && (
            <p className="pt-1 text-xs text-texto-suave">
              {textosAtividades.historicoLimitado(eventos.length, total)}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
