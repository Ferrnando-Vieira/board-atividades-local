import { asc, eq } from 'drizzle-orm';
import { PRIORIDADE, type ChaveStatusInicial } from '@/config/constantes';
import type { BancoDados } from '@/servidor/banco/conexao';
import { atividades, atividadesTags, tags } from '@/servidor/banco/esquema';
import { criarAtividade } from '@/servidor/atividades/atividadesServico';
import type { DadosAtividade } from '@/servidor/atividades/esquemasAtividades';
import {
  buscarBoardPadrao,
  listarStatusDoBoard,
  type StatusResumo,
} from '@/servidor/board/boardRepositorio';
import { SOLICITANTE_PADRAO_TESTE } from './bancoTeste';

// 15:00 UTC = 12:00 em America/Sao_Paulo, fuso padrão do board.
export const AGORA_TESTE = new Date('2026-10-01T15:00:00.000Z');
export const MOMENTO_LOCAL_TESTE = { data: '2026-10-01', hora: '12:00' };

export function exigirStatusPorChave(
  banco: BancoDados,
  chave: ChaveStatusInicial,
): StatusResumo {
  const board = buscarBoardPadrao(banco);
  const status = board
    ? listarStatusDoBoard(banco, board.id).find((item) => item.chave === chave)
    : undefined;
  if (!status) {
    throw new Error(`Status ${chave} ausente no banco de teste.`);
  }
  return status;
}

export function exigirBoardId(banco: BancoDados): number {
  const board = buscarBoardPadrao(banco);
  if (!board) {
    throw new Error('Board ausente no banco de teste.');
  }
  return board.id;
}

export function montarDadosAtividade(
  statusId: number,
  sobrescritas: Partial<DadosAtividade> = {},
): DadosAtividade {
  return {
    titulo: 'Atividade de teste',
    descricao: null,
    prioridade: PRIORIDADE.PADRAO,
    statusId,
    solicitante: SOLICITANTE_PADRAO_TESTE,
    tags: [],
    prazoData: null,
    prazoHora: null,
    concluidaEmData: null,
    concluidaEmHora: null,
    ...sobrescritas,
  };
}

export function criarAtividadesNoStatus(
  banco: BancoDados,
  statusId: number,
  titulos: readonly string[],
): number[] {
  return titulos.map(
    (titulo) =>
      criarAtividade(
        banco,
        montarDadosAtividade(statusId, { titulo }),
        AGORA_TESTE,
      ).atividadeId,
  );
}

export function buscarAtividadeGravada(banco: BancoDados, atividadeId: number) {
  const atividade = banco
    .select()
    .from(atividades)
    .where(eq(atividades.id, atividadeId))
    .get();
  if (!atividade) {
    throw new Error(`Atividade ${atividadeId} ausente no banco de teste.`);
  }
  return atividade;
}

export function listarNomesTagsDaAtividade(
  banco: BancoDados,
  atividadeId: number,
): string[] {
  return banco
    .select({ nome: tags.nome })
    .from(atividadesTags)
    .innerJoin(tags, eq(tags.id, atividadesTags.tagId))
    .where(eq(atividadesTags.atividadeId, atividadeId))
    .orderBy(asc(tags.nome))
    .all()
    .map((linha) => linha.nome);
}
