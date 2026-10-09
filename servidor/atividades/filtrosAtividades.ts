import {
  and,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { atividades, atividadesTags } from '@/servidor/banco/esquema';

export const SITUACOES_ARQUIVAMENTO = [
  'ativas',
  'arquivadas',
  'todas',
] as const;

export type SituacaoArquivamento = (typeof SITUACOES_ARQUIVAMENTO)[number];

// Mesma semântica do escopo dos links: valores de uma dimensão combinam com
// OU, dimensões diferentes combinam com E e dimensão vazia não restringe.
// Serve tanto para restringir o que um acesso pode ver quanto para o filtro
// escolhido por quem consulta; os dois são aplicados juntos (E).
export type FiltroAtividades = {
  statusIds: readonly number[];
  tagIds: readonly number[];
  solicitanteIds: readonly number[];
  prioridadeMinima: number | null;
  prioridadeMaxima: number | null;
  arquivamento: SituacaoArquivamento;
};

// `null` significa acesso sem restrição (administrador, link completo e API).
export type RestricaoLeitura = FiltroAtividades | null;

export const FILTRO_ABERTO: FiltroAtividades = {
  statusIds: [],
  tagIds: [],
  solicitanteIds: [],
  prioridadeMinima: null,
  prioridadeMaxima: null,
  arquivamento: 'todas',
};

export function criarFiltroAtividades(
  parcial: Partial<FiltroAtividades>,
): FiltroAtividades {
  return { ...FILTRO_ABERTO, ...parcial };
}

function condicaoArquivamento(situacao: SituacaoArquivamento) {
  if (situacao === 'ativas') {
    return isNull(atividades.arquivadaEm);
  }
  return situacao === 'arquivadas'
    ? isNotNull(atividades.arquivadaEm)
    : undefined;
}

function condicaoTags(tagIds: readonly number[]): SQL | undefined {
  if (tagIds.length === 0) {
    return undefined;
  }
  return sql`exists (select 1 from ${atividadesTags} where ${atividadesTags.atividadeId} = ${atividades.id} and ${inArray(atividadesTags.tagId, [...tagIds])})`;
}

export function montarCondicaoFiltro(
  filtro: FiltroAtividades | null,
): SQL | undefined {
  if (!filtro) {
    return undefined;
  }
  return and(
    filtro.statusIds.length > 0
      ? inArray(atividades.statusId, [...filtro.statusIds])
      : undefined,
    condicaoTags(filtro.tagIds),
    filtro.solicitanteIds.length > 0
      ? inArray(atividades.solicitanteId, [...filtro.solicitanteIds])
      : undefined,
    filtro.prioridadeMinima === null
      ? undefined
      : gte(atividades.prioridade, filtro.prioridadeMinima),
    filtro.prioridadeMaxima === null
      ? undefined
      : lte(atividades.prioridade, filtro.prioridadeMaxima),
    condicaoArquivamento(filtro.arquivamento),
  );
}
