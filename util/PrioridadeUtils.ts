export type NivelPrioridade = 'critica' | 'alta' | 'media' | 'baixa';

const LIMITE_PRIORIDADE_CRITICA = 1;
const LIMITE_PRIORIDADE_ALTA = 3;
const LIMITE_PRIORIDADE_MEDIA = 6;

// Quanto menor o número, mais crítica a atividade (0 a 9).
export function obterNivelPrioridade(prioridade: number): NivelPrioridade {
  if (prioridade <= LIMITE_PRIORIDADE_CRITICA) {
    return 'critica';
  }
  if (prioridade <= LIMITE_PRIORIDADE_ALTA) {
    return 'alta';
  }
  return prioridade <= LIMITE_PRIORIDADE_MEDIA ? 'media' : 'baixa';
}
