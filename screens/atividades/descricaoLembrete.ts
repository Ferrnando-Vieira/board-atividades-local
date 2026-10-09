import type { SituacaoLembrete } from '@/config/constantes';
import { textosAtividades as textos } from '@/screens/atividades/textosAtividades';
import { formatarInstanteParaExibicao } from '@/util/DataUtils';

export type DadosLembreteExibido = {
  lembreteEm: string | null;
  lembreteSituacao: SituacaoLembrete | null;
  lembreteDisparadoEm: string | null;
  lembreteDispensadoEm: string | null;
  arquivada: boolean;
};

export type DescricaoLembrete = {
  resumo: string;
  detalhe: string | null;
};

export type OperacaoLembrete = 'ativar' | 'desativar' | 'excluir';

type LembreteDefinido = DadosLembreteExibido & {
  lembreteEm: string;
  lembreteSituacao: SituacaoLembrete;
};

function detalharLembrete(
  dados: LembreteDefinido,
  agora: Date,
  fusoHorario: string,
): string | null {
  const vencido = new Date(dados.lembreteEm).getTime() <= agora.getTime();
  if (dados.lembreteSituacao === 'pendente') {
    if (dados.arquivada) {
      return textos.detalhesLembrete.arquivadaPendente;
    }
    return vencido ? textos.detalhesLembrete.pendenteVencido : null;
  }
  if (dados.lembreteSituacao === 'cancelado') {
    return vencido
      ? textos.detalhesLembrete.desativadoVencido
      : textos.detalhesLembrete.desativado;
  }
  if (dados.lembreteDisparadoEm === null) {
    return textos.detalhesLembrete.semMomentoDisparo;
  }
  const momentoDisparo = formatarInstanteParaExibicao(
    dados.lembreteDisparadoEm,
    fusoHorario,
  );
  return dados.lembreteDispensadoEm === null
    ? textos.detalhesLembrete.disparadoAguardando(momentoDisparo)
    : textos.detalhesLembrete.disparadoDispensado(momentoDisparo);
}

// Vencido é decidido aqui só para orientar a tela; o disparo e as recusas
// (reativar vencido, marcar no passado) são decididos no servidor.
export function descreverSituacaoLembrete(
  dados: DadosLembreteExibido,
  agora: Date,
  fusoHorario: string,
): DescricaoLembrete {
  const { lembreteEm, lembreteSituacao } = dados;
  if (lembreteEm === null || lembreteSituacao === null) {
    return { resumo: textos.semLembrete, detalhe: null };
  }
  return {
    resumo: textos.descreverLembrete(
      formatarInstanteParaExibicao(lembreteEm, fusoHorario),
      textos.situacoesLembrete[lembreteSituacao],
    ),
    detalhe: detalharLembrete(
      { ...dados, lembreteEm, lembreteSituacao },
      agora,
      fusoHorario,
    ),
  };
}

// Reativar só aparece se o horário ainda é futuro: o servidor recusaria o
// contrário, e o caminho certo é remarcar pelo formulário.
export function listarOperacoesLembrete(
  dados: Pick<DadosLembreteExibido, 'lembreteEm' | 'lembreteSituacao'>,
  agora: Date,
): OperacaoLembrete[] {
  const { lembreteEm, lembreteSituacao } = dados;
  if (lembreteEm === null || lembreteSituacao === null) {
    return [];
  }
  if (lembreteSituacao === 'pendente') {
    return ['desativar', 'excluir'];
  }
  if (lembreteSituacao === 'cancelado') {
    return new Date(lembreteEm).getTime() > agora.getTime()
      ? ['ativar', 'excluir']
      : ['excluir'];
  }
  return ['excluir'];
}
