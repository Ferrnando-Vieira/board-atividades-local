import { and, asc, eq, isNull } from 'drizzle-orm';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import { anexos, atividades } from '@/servidor/banco/esquema';
import {
  montarCondicaoFiltro,
  type RestricaoLeitura,
} from '@/servidor/atividades/filtrosAtividades';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';

export type AnexoResumo = {
  id: number;
  nomeOriginal: string;
  tipoConteudo: string;
  tamanhoBytes: number;
  criadoEm: string;
};

export type AnexoParaDownload = AnexoResumo & {
  identificadorArquivo: string;
};

export const COLUNAS_RESUMO_ANEXO = {
  id: anexos.id,
  nomeOriginal: anexos.nomeOriginal,
  tipoConteudo: anexos.tipoConteudo,
  tamanhoBytes: anexos.tamanhoBytes,
  criadoEm: anexos.criadoEm,
};

// Quem chama já conferiu que a atividade está no escopo do acesso.
export function listarAnexosDaAtividade(
  executor: ExecutorBanco,
  atividadeId: number,
): AnexoResumo[] {
  return executor
    .select(COLUNAS_RESUMO_ANEXO)
    .from(anexos)
    .where(and(eq(anexos.atividadeId, atividadeId), isNull(anexos.removidoEm)))
    .orderBy(asc(anexos.criadoEm), asc(anexos.id))
    .all();
}

export function retornarAnexoDaAtividade(
  executor: ExecutorBanco,
  atividadeId: number,
  anexoId: number,
): AnexoParaDownload | null {
  return (
    executor
      .select({
        ...COLUNAS_RESUMO_ANEXO,
        identificadorArquivo: anexos.identificadorArquivo,
      })
      .from(anexos)
      .where(
        and(
          eq(anexos.id, anexoId),
          eq(anexos.atividadeId, atividadeId),
          isNull(anexos.removidoEm),
        ),
      )
      .get() ?? null
  );
}

// O anexo só é devolvido se a atividade dele passar pela mesma restrição de
// leitura do board, da busca e do detalhe: um identificador digitado na URL
// não alcança anexo de atividade fora do escopo.
export function consultarAnexoAutorizado(
  executor: ExecutorBanco,
  anexoId: number,
  restricao: RestricaoLeitura,
): AnexoParaDownload | null {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return null;
  }
  return (
    executor
      .select({
        ...COLUNAS_RESUMO_ANEXO,
        identificadorArquivo: anexos.identificadorArquivo,
      })
      .from(anexos)
      .innerJoin(atividades, eq(atividades.id, anexos.atividadeId))
      .where(
        and(
          eq(anexos.id, anexoId),
          isNull(anexos.removidoEm),
          eq(atividades.boardId, board.id),
          montarCondicaoFiltro(restricao),
        ),
      )
      .get() ?? null
  );
}
