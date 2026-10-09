import { count, eq, inArray } from 'drizzle-orm';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import {
  atividades,
  atividadesTags,
  solicitantes,
  tags,
} from '@/servidor/banco/esquema';
import {
  compararTextos,
  gerarChaveNormalizada,
} from '@/util/NormalizacaoUtils';

export type TagResumo = {
  id: number;
  nome: string;
  // Nula = chip neutro do tema.
  cor: string | null;
};

export type TagGerenciavel = TagResumo & {
  quantidadeAtividades: number;
  // Nome do solicitante padrão da tag; nulo quando ela não define um.
  solicitantePadrao: string | null;
};

function ordenarPorNome<T extends { nome: string }>(itens: T[]): T[] {
  return itens.sort((primeiro, segundo) =>
    compararTextos(primeiro.nome, segundo.nome),
  );
}

export function agruparTagsPorAtividade(
  executor: ExecutorBanco,
  idsAtividades: readonly number[],
): Map<number, TagResumo[]> {
  const tagsPorAtividade = new Map<number, TagResumo[]>();
  if (idsAtividades.length === 0) {
    return tagsPorAtividade;
  }
  const vinculos = executor
    .select({
      atividadeId: atividadesTags.atividadeId,
      id: tags.id,
      nome: tags.nome,
      cor: tags.cor,
    })
    .from(atividadesTags)
    .innerJoin(tags, eq(tags.id, atividadesTags.tagId))
    .where(inArray(atividadesTags.atividadeId, [...idsAtividades]))
    .all();
  for (const vinculo of vinculos) {
    const lista = tagsPorAtividade.get(vinculo.atividadeId) ?? [];
    lista.push({ id: vinculo.id, nome: vinculo.nome, cor: vinculo.cor });
    tagsPorAtividade.set(vinculo.atividadeId, lista);
  }
  for (const lista of tagsPorAtividade.values()) {
    ordenarPorNome(lista);
  }
  return tagsPorAtividade;
}

export function listarTagsGerenciaveis(
  executor: ExecutorBanco,
  boardId: number,
): TagGerenciavel[] {
  const linhas = executor
    .select({
      id: tags.id,
      nome: tags.nome,
      cor: tags.cor,
      solicitantePadrao: solicitantes.nome,
      quantidadeAtividades: count(atividadesTags.atividadeId),
    })
    .from(tags)
    .leftJoin(atividadesTags, eq(atividadesTags.tagId, tags.id))
    .leftJoin(solicitantes, eq(solicitantes.id, tags.solicitantePadraoId))
    .where(eq(tags.boardId, boardId))
    .groupBy(tags.id)
    .all();
  return ordenarPorNome(linhas);
}

export function listarNomesTags(
  executor: ExecutorBanco,
  boardId: number,
): string[] {
  return listarTagsGerenciaveis(executor, boardId).map((tag) => tag.nome);
}

// Cor de cada tag pelo nome exibido, para os campos de tags que trabalham só
// com nomes (formulário e tags rápidas) pintarem os chips.
export function mapearCoresTags(
  executor: ExecutorBanco,
  boardId: number,
): Record<string, string | null> {
  return Object.fromEntries(
    listarTagsGerenciaveis(executor, boardId).map((tag) => [tag.nome, tag.cor]),
  );
}

// Solicitante padrão de cada tag pela chave normalizada do nome, para o
// formulário de atividade sugerir o solicitante conforme as tags escolhidas.
export function mapearSolicitantesPadraoTags(
  executor: ExecutorBanco,
  boardId: number,
): Record<string, string> {
  return Object.fromEntries(
    listarTagsGerenciaveis(executor, boardId).flatMap((tag) =>
      tag.solicitantePadrao === null
        ? []
        : [[gerarChaveNormalizada(tag.nome), tag.solicitantePadrao]],
    ),
  );
}

export type SolicitanteGerenciavel = {
  id: number;
  nome: string;
  padrao: boolean;
  quantidadeAtividades: number;
};

// Lista completa (inclusive sem uso), para escolher o escopo de um link e
// para a API; as sugestões do formulário seguem em listarSolicitantesSugeridos.
export function listarSolicitantesGerenciaveis(
  executor: ExecutorBanco,
  boardId: number,
): SolicitanteGerenciavel[] {
  const linhas = executor
    .select({
      id: solicitantes.id,
      nome: solicitantes.nome,
      padrao: solicitantes.padrao,
      quantidadeAtividades: count(atividades.id),
    })
    .from(solicitantes)
    .leftJoin(atividades, eq(atividades.solicitanteId, solicitantes.id))
    .where(eq(solicitantes.boardId, boardId))
    .groupBy(solicitantes.id)
    .all();
  return ordenarPorNome(linhas);
}

// Só entram na sugestão os solicitantes em uso e o padrão do board: um nome
// digitado errado e depois corrigido não fica sugerido para sempre.
export function listarSolicitantesSugeridos(
  executor: ExecutorBanco,
  boardId: number,
): string[] {
  const linhas = executor
    .select({
      nome: solicitantes.nome,
      padrao: solicitantes.padrao,
      quantidadeAtividades: count(atividades.id),
    })
    .from(solicitantes)
    .leftJoin(atividades, eq(atividades.solicitanteId, solicitantes.id))
    .where(eq(solicitantes.boardId, boardId))
    .groupBy(solicitantes.id)
    .all();
  return linhas
    .filter((linha) => linha.quantidadeAtividades > 0 || linha.padrao)
    .sort(
      (primeira, segunda) =>
        segunda.quantidadeAtividades - primeira.quantidadeAtividades ||
        compararTextos(primeira.nome, segunda.nome),
    )
    .map((linha) => linha.nome);
}
