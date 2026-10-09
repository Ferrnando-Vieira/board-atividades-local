import { and, asc, eq, isNull, max, notInArray, sql } from 'drizzle-orm';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import {
  atividades,
  atividadesTags,
  statusBoard,
  tags,
} from '@/servidor/banco/esquema';
import { mensagensAtividades as mensagens } from '@/servidor/atividades/mensagensAtividades';
import type { Conclusao } from '@/servidor/atividades/regrasConclusao';
import { garantirTag } from '@/servidor/classificacao/classificacaoRepositorio';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import {
  gerarChaveNormalizada,
  removerNomesRepetidos,
} from '@/util/NormalizacaoUtils';
import {
  CAMPOS_ORDEM_AUTOMATICA,
  type ItemConcluivel,
} from '@/util/OrdenacaoAtividadesUtils';

export const CODIGO_ATIVIDADE_INEXISTENTE = 'atividade-inexistente';
export const CODIGO_ATIVIDADE_ARQUIVADA = 'atividade-arquivada';
export const CODIGO_ATIVIDADE_NAO_ARQUIVADA = 'atividade-nao-arquivada';

export type AtividadeRegistro = typeof atividades.$inferSelect;

// A posição exibida vem só destes campos (a mesma regra do navegador). A
// coluna `ordem` continua sendo gravada apenas para o índice único por
// status; ela não decide mais onde o cartão aparece.
export const ORDEM_AUTOMATICA_ATIVIDADES = CAMPOS_ORDEM_AUTOMATICA.map(
  (campo) => asc(atividades[campo]),
);

export type AtividadePosicionavel = ItemConcluivel & {
  statusId: number;
  finalizaAtividade: boolean;
};

export function listarAtivasNaOrdemAutomatica(
  executor: ExecutorBanco,
  boardId: number,
): AtividadePosicionavel[] {
  return executor
    .select({
      id: atividades.id,
      statusId: atividades.statusId,
      titulo: atividades.titulo,
      prioridade: atividades.prioridade,
      criadoEm: atividades.criadoEm,
      prazoData: atividades.prazoData,
      prazoHora: atividades.prazoHora,
      concluidaEmData: atividades.concluidaEmData,
      concluidaEmHora: atividades.concluidaEmHora,
      finalizaAtividade: statusBoard.finalizaAtividade,
    })
    .from(atividades)
    .innerJoin(statusBoard, eq(statusBoard.id, atividades.statusId))
    .where(and(eq(atividades.boardId, boardId), isNull(atividades.arquivadaEm)))
    .orderBy(...ORDEM_AUTOMATICA_ATIVIDADES)
    .all();
}

export function incrementarVersaoAtividade() {
  return sql`${atividades.versao} + 1`;
}

export function exigirAtividade(
  executor: ExecutorBanco,
  boardId: number,
  atividadeId: number,
): AtividadeRegistro {
  const atividade = executor
    .select()
    .from(atividades)
    .where(and(eq(atividades.id, atividadeId), eq(atividades.boardId, boardId)))
    .get();
  if (!atividade) {
    throw new ErroApp(mensagens.atividadeInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGO_ATIVIDADE_INEXISTENTE,
    });
  }
  return atividade;
}

export function exigirAtividadeAtiva(
  executor: ExecutorBanco,
  boardId: number,
  atividadeId: number,
): AtividadeRegistro {
  const atividade = exigirAtividade(executor, boardId, atividadeId);
  if (atividade.arquivadaEm !== null) {
    throw new ErroApp(mensagens.atividadeArquivada, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGO_ATIVIDADE_ARQUIVADA,
    });
  }
  return atividade;
}

export function extrairConclusao(origem: Conclusao): Conclusao {
  return {
    concluidaEmData: origem.concluidaEmData,
    concluidaEmHora: origem.concluidaEmHora,
  };
}

function filtroAtivasDoStatus(statusId: number) {
  return and(eq(atividades.statusId, statusId), isNull(atividades.arquivadaEm));
}

export function listarIdsAtivosDoStatus(
  executor: ExecutorBanco,
  statusId: number,
): number[] {
  return executor
    .select({ id: atividades.id })
    .from(atividades)
    .where(filtroAtivasDoStatus(statusId))
    .orderBy(asc(atividades.ordem))
    .all()
    .map((linha) => linha.id);
}

function buscarMaiorOrdem(
  executor: ExecutorBanco,
  statusId: number,
): number | null {
  return (
    executor
      .select({ maiorOrdem: max(atividades.ordem) })
      .from(atividades)
      .where(filtroAtivasDoStatus(statusId))
      .get()?.maiorOrdem ?? null
  );
}

export function calcularProximaOrdem(
  executor: ExecutorBanco,
  statusId: number,
): number {
  const maiorOrdem = buscarMaiorOrdem(executor, statusId);
  return maiorOrdem === null ? 0 : maiorOrdem + 1;
}

// A ordem é única por status entre atividades ativas e o SQLite não adia
// UNIQUE; por isso a coluna inteira vai antes para uma faixa livre (acima de
// qualquer valor final) e só então recebe 0..n-1. A mesma gravação leva para
// o status as atividades vindas de outra coluna.
export function gravarOrdemDoStatus(
  executor: ExecutorBanco,
  statusId: number,
  idsEmOrdem: readonly number[],
): void {
  const maiorOrdem = buscarMaiorOrdem(executor, statusId);
  if (maiorOrdem !== null) {
    const deslocamento = maiorOrdem + idsEmOrdem.length + 1;
    executor
      .update(atividades)
      .set({ ordem: sql`${atividades.ordem} + ${deslocamento}` })
      .where(filtroAtivasDoStatus(statusId))
      .run();
  }
  idsEmOrdem.forEach((atividadeId, ordem) => {
    executor
      .update(atividades)
      .set({ statusId, ordem })
      .where(eq(atividades.id, atividadeId))
      .run();
  });
}

// Recebe nomes já normalizados e sem repetição (esquema Zod); cada nome passa
// pelo cadastro único de tags antes do vínculo.
export function sincronizarTagsDaAtividade(
  executor: ExecutorBanco,
  boardId: number,
  atividadeId: number,
  nomesTags: readonly string[],
): void {
  const idsTags = [
    ...new Set(
      nomesTags.map((nome) => garantirTag(executor, boardId, nome).id),
    ),
  ];
  executor
    .delete(atividadesTags)
    .where(
      and(
        eq(atividadesTags.atividadeId, atividadeId),
        notInArray(atividadesTags.tagId, idsTags),
      ),
    )
    .run();
  if (idsTags.length > 0) {
    executor
      .insert(atividadesTags)
      .values(idsTags.map((tagId) => ({ atividadeId, tagId })))
      .onConflictDoNothing()
      .run();
  }
}

// Tags informadas na ordem em que ficam vinculadas: primeiro as que a
// atividade já tinha, na ordem do vínculo (cada gravação insere numa só
// instrução, e o rowid guarda a ordem), depois as novas, na ordem recebida.
// É essa ordem que decide o solicitante padrão vindo das tags.
export function ordenarTagsPorVinculo(
  executor: ExecutorBanco,
  atividadeId: number,
  nomesTags: readonly string[],
): string[] {
  const informadas = new Map(
    removerNomesRepetidos(nomesTags).map((nome) => [
      gerarChaveNormalizada(nome),
      nome,
    ]),
  );
  const jaVinculadas = executor
    .select({ chave: tags.nomeNormalizado })
    .from(atividadesTags)
    .innerJoin(tags, eq(tags.id, atividadesTags.tagId))
    .where(eq(atividadesTags.atividadeId, atividadeId))
    .orderBy(asc(atividadesTags.criadoEm), sql`${atividadesTags}.rowid`)
    .all()
    .flatMap(({ chave }) => {
      const nome = informadas.get(chave);
      return nome === undefined ? [] : [nome];
    });
  const chavesVinculadas = new Set(jaVinculadas.map(gerarChaveNormalizada));
  return [
    ...jaVinculadas,
    ...[...informadas.values()].filter(
      (nome) => !chavesVinculadas.has(gerarChaveNormalizada(nome)),
    ),
  ];
}

export function listarIdsTagsDaAtividade(
  executor: ExecutorBanco,
  atividadeId: number,
): number[] {
  return executor
    .select({ id: atividadesTags.tagId })
    .from(atividadesTags)
    .where(eq(atividadesTags.atividadeId, atividadeId))
    .all()
    .map((linha) => linha.id);
}
