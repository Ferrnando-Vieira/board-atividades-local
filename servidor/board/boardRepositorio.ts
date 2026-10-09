import { and, asc, eq, sql } from 'drizzle-orm';
import {
  BOARD_PADRAO,
  FUSO_HORARIO_PADRAO,
  LIMITES_TEXTO,
  STATUS_INICIAIS,
} from '@/config/constantes';
import { exigirAtualizacaoComVersao } from '@/servidor/banco/concorrencia';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { boards, statusBoard } from '@/servidor/banco/esquema';
import { mensagensStatus } from '@/servidor/board/mensagensStatus';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { normalizarNomeExibicao } from '@/util/NormalizacaoUtils';

export type ResultadoInicializacaoBoard = {
  boardId: number;
  boardCriado: boolean;
  statusCriados: number;
};

export type BoardResumo = typeof boards.$inferSelect;

export type StatusResumo = typeof statusBoard.$inferSelect;

export function buscarBoardPadrao(
  executor: ExecutorBanco,
): BoardResumo | undefined {
  return executor
    .select()
    .from(boards)
    .where(eq(boards.chave, BOARD_PADRAO.chave))
    .get();
}

export function listarStatusDoBoard(
  executor: ExecutorBanco,
  boardId: number,
): StatusResumo[] {
  return executor
    .select()
    .from(statusBoard)
    .where(eq(statusBoard.boardId, boardId))
    .orderBy(asc(statusBoard.posicao))
    .all();
}

export const CODIGO_BOARD_AUSENTE = 'board-ausente';
export const CODIGO_STATUS_INEXISTENTE = 'status-inexistente';

export function exigirBoardPadrao(executor: ExecutorBanco): BoardResumo {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    throw new ErroApp(mensagensStatus.boardAusente, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGO_BOARD_AUSENTE,
    });
  }
  return board;
}

export function exigirStatusDoBoard(
  executor: ExecutorBanco,
  boardId: number,
  statusId: number,
): StatusResumo {
  const status = executor
    .select()
    .from(statusBoard)
    .where(and(eq(statusBoard.id, statusId), eq(statusBoard.boardId, boardId)))
    .get();
  if (!status) {
    throw new ErroApp(mensagensStatus.statusInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGO_STATUS_INEXISTENTE,
    });
  }
  return status;
}

// Os status iniciais nascem junto com o board. Se o board já existe nada é
// recriado, para não ressuscitar o que o usuário removeu depois. O solicitante
// padrão não nasce aqui: ele é informado na configuração inicial.
export function garantirBoardPadrao(
  banco: BancoDados,
): ResultadoInicializacaoBoard {
  return banco.transaction(
    (transacao) => {
      const existente = buscarBoardPadrao(transacao);
      if (existente) {
        return {
          boardId: existente.id,
          boardCriado: false,
          statusCriados: 0,
        };
      }
      const board = transacao
        .insert(boards)
        .values({
          chave: BOARD_PADRAO.chave,
          nome: BOARD_PADRAO.nome,
          fusoHorario: FUSO_HORARIO_PADRAO,
        })
        .returning({ id: boards.id })
        .get();
      transacao
        .insert(statusBoard)
        .values(
          STATUS_INICIAIS.map((status, posicao) => ({
            boardId: board.id,
            chave: status.chave,
            nome: status.nome,
            posicao,
            finalizaAtividade: status.finalizaAtividade,
          })),
        )
        .run();
      return {
        boardId: board.id,
        boardCriado: true,
        statusCriados: STATUS_INICIAIS.length,
      };
    },
    { behavior: 'immediate' },
  );
}

export type AlteracaoConfiguracaoBoard = {
  boardId: number;
  versaoEsperada: number;
  nome: string;
  fusoHorario: string;
};

function validarFusoHorario(fusoHorario: string): void {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: fusoHorario });
  } catch {
    throw new ErroApp(`Fuso horário desconhecido: ${fusoHorario}`, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: 'fuso-horario-invalido',
    });
  }
}

function validarNomeBoard(nome: string): string {
  const nomeNormalizado = normalizarNomeExibicao(nome);
  if (
    nomeNormalizado.length === 0 ||
    nomeNormalizado.length > LIMITES_TEXTO.NOME_BOARD
  ) {
    throw new ErroApp(
      `O nome do board deve ter entre 1 e ${LIMITES_TEXTO.NOME_BOARD} caracteres.`,
      {
        status: STATUS_ERRO.REQUISICAO_INVALIDA,
        codigo: 'nome-board-invalido',
      },
    );
  }
  return nomeNormalizado;
}

export function atualizarConfiguracaoBoard(
  executor: ExecutorBanco,
  alteracao: AlteracaoConfiguracaoBoard,
): void {
  validarFusoHorario(alteracao.fusoHorario);
  const resultado = executor
    .update(boards)
    .set({
      nome: validarNomeBoard(alteracao.nome),
      fusoHorario: alteracao.fusoHorario,
      versao: sql`${boards.versao} + 1`,
    })
    .where(
      and(
        eq(boards.id, alteracao.boardId),
        eq(boards.versao, alteracao.versaoEsperada),
      ),
    )
    .run();
  exigirAtualizacaoComVersao(resultado, 'O board');
}
