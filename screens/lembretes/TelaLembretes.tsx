import Link from 'next/link';
import CabecalhoPagina from '@/components/ui/CabecalhoPagina';
import Cartao from '@/components/ui/Cartao';
import Icone from '@/components/ui/Icone';
import { FUSO_HORARIO_PADRAO, LEMBRETES } from '@/config/constantes';
import { montarRotaAtividade } from '@/config/rotas';
import FormularioLembreteAvulso from '@/screens/lembretes/FormularioLembreteAvulso';
import ItemLembreteAvulso, {
  type LembreteAvulsoExibido,
} from '@/screens/lembretes/ItemLembreteAvulso';
import { textosLembretes as textos } from '@/screens/lembretes/textosLembretes';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  listarLembretesAvulsos,
  type LembreteAvulso,
} from '@/servidor/lembretes/lembretesAvulsosServico';
import { listarProximosLembretesAtividades } from '@/servidor/lembretes/lembretesRepositorio';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  formatarInstanteParaExibicao,
  obterMomentoLocal,
} from '@/util/DataUtils';

type ProximoDaPagina = {
  chave: string;
  titulo: string;
  lembreteEm: string;
  destino: string;
  origem: 'atividade' | 'avulso';
};

function exibirAvulso(
  lembrete: LembreteAvulso,
  fusoHorario: string,
): LembreteAvulsoExibido {
  const local = obterMomentoLocal(new Date(lembrete.lembreteEm), fusoHorario);
  return {
    id: lembrete.id,
    versao: lembrete.versao,
    titulo: lembrete.titulo,
    observacao: lembrete.observacao,
    data: local.data,
    hora: local.hora,
    situacao: lembrete.situacao,
    horarioExibido: formatarInstanteParaExibicao(
      lembrete.lembreteEm,
      fusoHorario,
    ),
    dispensado: lembrete.dispensadoEm !== null,
  };
}

// Tela só do proprietário (a página confere a sessão). Lembretes de
// atividade aparecem em "Próximos" com link para a atividade, onde são
// editados; os avulsos são geridos aqui.
export default function TelaLembretes() {
  const banco = obterBancoAplicacao();
  const agora = new Date();
  const fusoHorario =
    buscarBoardPadrao(banco)?.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const dataMinima = obterMomentoLocal(agora, fusoHorario).data;
  const avulsos = listarLembretesAvulsos(banco);
  const proximos: ProximoDaPagina[] = [
    ...listarProximosLembretesAtividades(
      banco,
      agora,
      LEMBRETES.MAXIMO_PROXIMOS_LISTADOS,
    ).map((lembrete) => ({
      chave: `atividade-${lembrete.atividadeId}`,
      titulo: lembrete.titulo,
      lembreteEm: lembrete.lembreteEm,
      destino: montarRotaAtividade(lembrete.atividadeId),
      origem: 'atividade' as const,
    })),
    ...avulsos
      .filter(
        (lembrete) =>
          lembrete.situacao === 'pendente' &&
          new Date(lembrete.lembreteEm).getTime() > agora.getTime(),
      )
      .map((lembrete) => ({
        chave: `avulso-${lembrete.id}`,
        titulo: lembrete.titulo,
        lembreteEm: lembrete.lembreteEm,
        destino: `#lembrete-${lembrete.id}`,
        origem: 'avulso' as const,
      })),
  ]
    .sort((primeiro, segundo) =>
      primeiro.lembreteEm.localeCompare(segundo.lembreteEm),
    )
    .slice(0, LEMBRETES.MAXIMO_PROXIMOS_LISTADOS);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <CabecalhoPagina
        titulo={textos.tituloPagina}
        descricao={textos.descricaoPagina}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Cartao className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icone nome="mais" className="text-primaria" />
            {textos.tituloNovo}
          </h2>
          <FormularioLembreteAvulso
            dataMinima={dataMinima}
            fusoHorario={fusoHorario}
          />
        </Cartao>
        <Cartao className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icone nome="relogio" className="text-primaria" />
            {textos.tituloProximos}
          </h2>
          {proximos.length === 0 ? (
            <p className="text-sm text-texto-suave">{textos.nenhumProximo}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda">
              {proximos.map((proximo) => (
                <li
                  key={proximo.chave}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <Link
                    href={proximo.destino}
                    className="min-w-0 text-sm font-medium break-words hover:text-primaria hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
                  >
                    {proximo.titulo}
                  </Link>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-texto-suave">
                    <span>
                      {formatarInstanteParaExibicao(
                        proximo.lembreteEm,
                        fusoHorario,
                      )}
                    </span>
                    <span className="font-medium">
                      {textos.origens[proximo.origem]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
      <Cartao className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icone nome="sino" className="text-primaria" />
          {textos.tituloAvulsos}
        </h2>
        {avulsos.length === 0 ? (
          <p className="text-sm text-texto-suave">{textos.semAvulsos}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda">
            {avulsos.map((lembrete) => (
              <ItemLembreteAvulso
                key={`${lembrete.id}-${lembrete.versao}`}
                lembrete={exibirAvulso(lembrete, fusoHorario)}
                dataMinima={dataMinima}
                fusoHorario={fusoHorario}
              />
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
