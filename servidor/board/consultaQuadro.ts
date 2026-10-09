import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import {
  atividades,
  solicitantes,
  statusBoard,
} from '@/servidor/banco/esquema';
import {
  montarCondicaoFiltro,
  type RestricaoLeitura,
} from '@/servidor/atividades/filtrosAtividades';
import { ORDEM_AUTOMATICA_ATIVIDADES } from '@/servidor/atividades/atividadesRepositorio';
import {
  buscarBoardPadrao,
  listarStatusDoBoard,
} from '@/servidor/board/boardRepositorio';
import {
  agruparTagsPorAtividade,
  type TagResumo,
} from '@/servidor/classificacao/consultasClassificacao';
import { obterMomentoLocal, type MomentoLocal } from '@/util/DataUtils';
import { ordenarNaColuna } from '@/util/OrdenacaoAtividadesUtils';

export type CartaoQuadro = {
  id: number;
  titulo: string;
  prioridade: number;
  versao: number;
  criadoEm: string;
  solicitanteId: number;
  solicitante: string;
  tags: TagResumo[];
  prazoData: string | null;
  prazoHora: string | null;
  concluidaEmData: string | null;
  concluidaEmHora: string | null;
};

export type ColunaQuadro = {
  id: number;
  nome: string;
  finalizaAtividade: boolean;
  corTitulo: string | null;
  corColuna: string | null;
  atividades: CartaoQuadro[];
};

// `momentoLocal` vai junto para que servidor e navegador calculem a situação
// do prazo com o mesmo "agora", sem divergência na hidratação.
export type QuadroAtividades = {
  nomeBoard: string;
  momentoLocal: MomentoLocal;
  colunas: ColunaQuadro[];
};

export type StatusGerenciavel = {
  id: number;
  nome: string;
  finalizaAtividade: boolean;
  corTitulo: string | null;
  corColuna: string | null;
  versao: number;
  quantidadeAtivas: number;
  quantidadeArquivadas: number;
};

function listarCartoesAtivos(
  executor: ExecutorBanco,
  boardId: number,
  restricao: RestricaoLeitura,
) {
  return executor
    .select({
      id: atividades.id,
      statusId: atividades.statusId,
      titulo: atividades.titulo,
      prioridade: atividades.prioridade,
      versao: atividades.versao,
      criadoEm: atividades.criadoEm,
      solicitanteId: atividades.solicitanteId,
      solicitante: solicitantes.nome,
      prazoData: atividades.prazoData,
      prazoHora: atividades.prazoHora,
      concluidaEmData: atividades.concluidaEmData,
      concluidaEmHora: atividades.concluidaEmHora,
    })
    .from(atividades)
    .innerJoin(solicitantes, eq(solicitantes.id, atividades.solicitanteId))
    .where(
      and(
        eq(atividades.boardId, boardId),
        isNull(atividades.arquivadaEm),
        montarCondicaoFiltro(restricao),
      ),
    )
    .orderBy(...ORDEM_AUTOMATICA_ATIVIDADES)
    .all();
}

// Com restrição (link restrito), as colunas continuam todas, mas só recebem
// os cartões do escopo; contagens e tags vêm apenas desses cartões.
export function consultarQuadro(
  executor: ExecutorBanco,
  agora: Date = new Date(),
  restricao: RestricaoLeitura = null,
): QuadroAtividades | null {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return null;
  }
  const cartoes = listarCartoesAtivos(executor, board.id, restricao);
  const tagsPorAtividade = agruparTagsPorAtividade(
    executor,
    cartoes.map((cartao) => cartao.id),
  );
  const cartoesPorStatus = new Map<number, CartaoQuadro[]>();
  for (const { statusId, ...cartao } of cartoes) {
    const lista = cartoesPorStatus.get(statusId) ?? [];
    lista.push({ ...cartao, tags: tagsPorAtividade.get(cartao.id) ?? [] });
    cartoesPorStatus.set(statusId, lista);
  }
  return {
    nomeBoard: board.nome,
    momentoLocal: obterMomentoLocal(agora, board.fusoHorario),
    colunas: listarStatusDoBoard(executor, board.id).map((status) => ({
      id: status.id,
      nome: status.nome,
      finalizaAtividade: status.finalizaAtividade,
      corTitulo: status.corTitulo,
      corColuna: status.corColuna,
      atividades: ordenarNaColuna(
        cartoesPorStatus.get(status.id) ?? [],
        status.finalizaAtividade,
      ),
    })),
  };
}

// count(coluna) ignora nulos: o total menos as arquivadas dá as ativas.
export function listarStatusGerenciaveis(
  executor: ExecutorBanco,
  boardId: number,
): StatusGerenciavel[] {
  return executor
    .select({
      id: statusBoard.id,
      nome: statusBoard.nome,
      finalizaAtividade: statusBoard.finalizaAtividade,
      corTitulo: statusBoard.corTitulo,
      corColuna: statusBoard.corColuna,
      versao: statusBoard.versao,
      quantidadeAtivas: sql<number>`count(${atividades.id}) - count(${atividades.arquivadaEm})`,
      quantidadeArquivadas: count(atividades.arquivadaEm),
    })
    .from(statusBoard)
    .leftJoin(atividades, eq(atividades.statusId, statusBoard.id))
    .where(eq(statusBoard.boardId, boardId))
    .groupBy(statusBoard.id)
    .orderBy(asc(statusBoard.posicao))
    .all();
}
