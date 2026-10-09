// Regra base de posição dos cartões: criticidade (0 vem primeiro), depois a
// data de abertura (a mais antiga primeiro) e, no empate, o identificador. O
// servidor pré-ordena pelos mesmos campos (ORDER BY) e o refinamento por coluna
// (ver ordenarNaColuna) roda igual no servidor e no navegador, então as duas
// pontas nunca divergem. Nas colunas que não finalizam, a regra é prioridade,
// prazo (mais próximo primeiro, sem prazo no fim), título e, por fim, esta
// ordem base; as colunas que finalizam usam a conclusão mais recente.
export const CAMPOS_ORDEM_AUTOMATICA = [
  'prioridade',
  'criadoEm',
  'id',
] as const;

export type CampoOrdemAutomatica = (typeof CAMPOS_ORDEM_AUTOMATICA)[number];

export type ItemOrdenavel = {
  prioridade: number;
  criadoEm: string;
  id: number;
};

type Comparador = (primeiro: ItemOrdenavel, segundo: ItemOrdenavel) => number;

// Instantes ISO em UTC no mesmo formato comparam corretamente como texto,
// exatamente como o SQLite compara a coluna.
function compararTextoBinario(primeiro: string, segundo: string): number {
  if (primeiro === segundo) {
    return 0;
  }
  return primeiro < segundo ? -1 : 1;
}

const COMPARADORES: Record<CampoOrdemAutomatica, Comparador> = {
  prioridade: (primeiro, segundo) => primeiro.prioridade - segundo.prioridade,
  criadoEm: (primeiro, segundo) =>
    compararTextoBinario(primeiro.criadoEm, segundo.criadoEm),
  id: (primeiro, segundo) => primeiro.id - segundo.id,
};

export function compararPorOrdemAutomatica(
  primeiro: ItemOrdenavel,
  segundo: ItemOrdenavel,
): number {
  for (const campo of CAMPOS_ORDEM_AUTOMATICA) {
    const resultado = COMPARADORES[campo](primeiro, segundo);
    if (resultado !== 0) {
      return resultado;
    }
  }
  return 0;
}

export function ordenarPorOrdemAutomatica<T extends ItemOrdenavel>(
  itens: readonly T[],
): T[] {
  return [...itens].sort(compararPorOrdemAutomatica);
}

export type ItemConcluivel = ItemOrdenavel & {
  titulo: string;
  prazoData: string | null;
  prazoHora: string | null;
  concluidaEmData: string | null;
  concluidaEmHora: string | null;
};

const COLETOR_TITULOS = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
  numeric: true,
});

// Prazo como texto comparável; sem data não há prazo (vai para o fim) e sem
// hora vale o fim do dia, depois dos cartões com hora marcada no mesmo dia.
function montarChavePrazo(item: ItemConcluivel): string | null {
  return item.prazoData
    ? `${item.prazoData}T${item.prazoHora ?? '23:59'}`
    : null;
}

// Nas colunas que não finalizam: prioridade, prazo mais próximo primeiro (sem
// prazo no fim), título em ordem alfabética e, no empate, a ordem base.
export function compararPorPrazoETitulo(
  primeiro: ItemConcluivel,
  segundo: ItemConcluivel,
): number {
  const prioridade = primeiro.prioridade - segundo.prioridade;
  if (prioridade !== 0) {
    return prioridade;
  }
  const prazoPrimeiro = montarChavePrazo(primeiro);
  const prazoSegundo = montarChavePrazo(segundo);
  if (prazoPrimeiro !== prazoSegundo) {
    if (prazoPrimeiro === null) {
      return 1;
    }
    if (prazoSegundo === null) {
      return -1;
    }
    return compararTextoBinario(prazoPrimeiro, prazoSegundo);
  }
  const titulo = COLETOR_TITULOS.compare(primeiro.titulo, segundo.titulo);
  return titulo !== 0 ? titulo : compararPorOrdemAutomatica(primeiro, segundo);
}

// Data e hora de conclusão como um texto comparável. Sem data a chave fica
// vazia (a mais antiga); sem hora vale o início do dia.
function montarChaveConclusao(item: ItemConcluivel): string {
  return item.concluidaEmData
    ? `${item.concluidaEmData}T${item.concluidaEmHora ?? '00:00'}`
    : '';
}

// Nas colunas que finalizam a atividade, a conclusão mais recente vem
// primeiro; o empate (ou a falta de conclusão) cai na ordem automática.
export function compararPorConclusaoRecente(
  primeiro: ItemConcluivel,
  segundo: ItemConcluivel,
): number {
  const resultado = compararTextoBinario(
    montarChaveConclusao(segundo),
    montarChaveConclusao(primeiro),
  );
  return resultado !== 0
    ? resultado
    : compararPorOrdemAutomatica(primeiro, segundo);
}

export function ordenarNaColuna<T extends ItemConcluivel>(
  itens: readonly T[],
  finalizaAtividade: boolean,
): T[] {
  return [...itens].sort(
    finalizaAtividade ? compararPorConclusaoRecente : compararPorPrazoETitulo,
  );
}
