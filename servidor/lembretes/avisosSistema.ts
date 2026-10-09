import { FUSO_HORARIO_PADRAO } from '@/config/constantes';
import { montarRotaAtividade, ROTAS } from '@/config/rotas';
import type { BancoDados } from '@/servidor/banco/conexao';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';
import { dispararLembretesAvulsosVencidos } from '@/servidor/lembretes/lembretesAvulsosServico';
import { dispararLembretesVencidos } from '@/servidor/lembretes/lembretesServico';
import { formatarInstanteParaExibicao } from '@/util/DataUtils';

const ANCORA_LEMBRETE = '#lembrete-';

export type AvisoSistema = {
  titulo: string;
  corpo: string;
  url: string;
};

type DadosAviso = {
  titulo: string;
  observacao: string | null;
  lembreteEm: string;
  atrasado: boolean;
  rota: string;
};

function montarCorpo(aviso: DadosAviso, fusoHorario: string): string {
  const horario = formatarInstanteParaExibicao(aviso.lembreteEm, fusoHorario);
  const situacao = aviso.atrasado
    ? `Atrasado: estava marcado para ${horario}.`
    : `Marcado para ${horario}.`;
  return aviso.observacao ? `${situacao} ${aviso.observacao}` : situacao;
}

// Dispara os lembretes vencidos (atividade e avulsos) e devolve o que deve
// aparecer como notificação do sistema. O disparo é o mesmo da central do
// navegador: a troca de pendente para disparado é atômica, então cada aviso
// sai uma única vez, venha do vigia ou de uma aba aberta. Quem dispara
// primeiro leva o aviso; o outro o encontra na lista de avisos a dispensar.
export function coletarAvisosSistema(
  banco: BancoDados,
  urlBase: string,
  agora: Date = new Date(),
): AvisoSistema[] {
  const fusoHorario =
    buscarBoardPadrao(banco)?.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const dados: DadosAviso[] = [
    ...dispararLembretesVencidos(banco, agora).map((aviso) => ({
      titulo: aviso.titulo,
      observacao: null,
      lembreteEm: aviso.lembreteEm,
      atrasado: aviso.atrasado,
      rota: montarRotaAtividade(aviso.atividadeId),
    })),
    ...dispararLembretesAvulsosVencidos(banco, agora).map((aviso) => ({
      titulo: aviso.titulo,
      observacao: aviso.observacao,
      lembreteEm: aviso.lembreteEm,
      atrasado: aviso.atrasado,
      rota: `${ROTAS.LEMBRETES}${ANCORA_LEMBRETE}${aviso.lembreteId}`,
    })),
  ];
  return dados.map((aviso) => ({
    titulo: `Lembrete: ${aviso.titulo}`,
    corpo: montarCorpo(aviso, fusoHorario),
    url: `${urlBase}${aviso.rota}`,
  }));
}
