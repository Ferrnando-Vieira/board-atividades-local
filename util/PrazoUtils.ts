import { somarDiasNaData, type MomentoLocal } from '@/util/DataUtils';

export type SituacaoPrazo = 'vencido' | 'hoje' | 'proximo' | 'no-prazo';

// Amanhã e depois de amanhã contam como "próximo do vencimento".
export const DIAS_PRAZO_PROXIMO = 2;

export type Prazo = {
  prazoData: string | null;
  prazoHora: string | null;
};

// Datas e horas ISO (AAAA-MM-DD e HH:MM) no mesmo fuso comparam corretamente
// como texto. Prazo sem hora vence só no fim do dia.
export function calcularSituacaoPrazo(
  prazo: Prazo,
  agora: MomentoLocal,
): SituacaoPrazo | null {
  if (!prazo.prazoData) {
    return null;
  }
  if (prazo.prazoData < agora.data) {
    return 'vencido';
  }
  if (prazo.prazoData > agora.data) {
    return prazo.prazoData <= somarDiasNaData(agora.data, DIAS_PRAZO_PROXIMO)
      ? 'proximo'
      : 'no-prazo';
  }
  if (prazo.prazoHora && prazo.prazoHora < agora.hora) {
    return 'vencido';
  }
  return 'hoje';
}
