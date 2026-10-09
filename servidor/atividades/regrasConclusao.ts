import type { MomentoLocal } from '@/util/DataUtils';

export type Conclusao = {
  concluidaEmData: string | null;
  concluidaEmHora: string | null;
};

export const SEM_CONCLUSAO: Conclusao = {
  concluidaEmData: null,
  concluidaEmHora: null,
};

function registrarAgora(momentoAtual: MomentoLocal): Conclusao {
  return {
    concluidaEmData: momentoAtual.data,
    concluidaEmHora: momentoAtual.hora,
  };
}

// Regra do board: atividade num status que finaliza tem data de conclusão;
// nos demais status, não tem. Em formulário, a data informada prevalece e,
// se ficar em branco, registra-se o momento atual no fuso do board.
export function definirConclusaoDoFormulario(
  destinoFinaliza: boolean,
  informada: Conclusao,
  momentoAtual: MomentoLocal,
): Conclusao {
  if (!destinoFinaliza) {
    return SEM_CONCLUSAO;
  }
  return informada.concluidaEmData ? informada : registrarAgora(momentoAtual);
}

// Reordenar dentro do mesmo status não altera a conclusão. Ao trocar de
// status, uma conclusão já registrada é mantida se o destino também finaliza
// (não se perde a data original), e é limpa se o destino não finaliza.
export function definirConclusaoDoMovimento(
  destinoFinaliza: boolean,
  mudouStatus: boolean,
  atual: Conclusao,
  momentoAtual: MomentoLocal,
): Conclusao {
  if (!mudouStatus) {
    return atual;
  }
  if (!destinoFinaliza) {
    return SEM_CONCLUSAO;
  }
  return atual.concluidaEmData ? atual : registrarAgora(momentoAtual);
}
