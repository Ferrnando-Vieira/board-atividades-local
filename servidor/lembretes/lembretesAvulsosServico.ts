import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';
import { LEMBRETES, type SituacaoLembrete } from '@/config/constantes';
import { exigirVersaoEsperada } from '@/servidor/banco/concorrencia';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { lembretesAvulsos } from '@/servidor/banco/esquema';
import {
  buscarBoardPadrao,
  exigirBoardPadrao,
  type BoardResumo,
} from '@/servidor/board/boardRepositorio';
import type {
  AlteracaoLembreteAvulso,
  DispensaLembreteAvulso,
  EdicaoLembreteAvulso,
  NovoLembreteAvulso,
} from '@/servidor/lembretes/esquemasLembretes';
import { CODIGOS_LEMBRETE } from '@/servidor/lembretes/lembretesServico';
import { mensagensLembretes as mensagens } from '@/servidor/lembretes/mensagensLembretes';
import { converterHorarioLocalParaUtc, somarMinutos } from '@/util/DataUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

export const CODIGO_LEMBRETE_AVULSO_INEXISTENTE = 'lembrete-avulso-inexistente';

type LembreteAvulsoRegistro = typeof lembretesAvulsos.$inferSelect;

export type LembreteAvulso = {
  id: number;
  titulo: string;
  observacao: string | null;
  lembreteEm: string;
  situacao: SituacaoLembrete;
  disparadoEm: string | null;
  dispensadoEm: string | null;
  versao: number;
};

export type NotificacaoLembreteAvulso = {
  lembreteId: number;
  titulo: string;
  observacao: string | null;
  lembreteEm: string;
  disparadoEm: string;
  atrasado: boolean;
};

// Disparar e dispensar mudam o estado do aviso, não o lembrete: a versão e o
// "atualizado em" ficam como estavam, para não invalidar uma edição aberta.
const PRESERVAR_ATUALIZADO_EM = {
  atualizadoEm: sql`${lembretesAvulsos.atualizadoEm}`,
};

function converterRegistro(registro: LembreteAvulsoRegistro): LembreteAvulso {
  return {
    id: registro.id,
    titulo: registro.titulo,
    observacao: registro.observacao,
    lembreteEm: registro.lembreteEm,
    situacao: registro.situacao,
    disparadoEm: registro.disparadoEm,
    dispensadoEm: registro.dispensadoEm,
    versao: registro.versao,
  };
}

function erroConflito(mensagem: string, codigo: string): ErroApp {
  return new ErroApp(mensagem, { status: STATUS_ERRO.CONFLITO, codigo });
}

function converterInstanteFuturo(
  board: BoardResumo,
  data: string,
  hora: string,
  agora: Date,
): string {
  const instante = converterHorarioLocalParaUtc(data, hora, board.fusoHorario);
  if (instante.getTime() <= agora.getTime()) {
    throw new ErroApp(mensagens.lembreteNoPassado, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_LEMBRETE.NO_PASSADO,
    });
  }
  return instante.toISOString();
}

function exigirLembreteNaVersao(
  executor: ExecutorBanco,
  boardId: number,
  lembreteId: number,
  versaoEsperada: number,
): LembreteAvulsoRegistro {
  const registro = executor
    .select()
    .from(lembretesAvulsos)
    .where(
      and(
        eq(lembretesAvulsos.id, lembreteId),
        eq(lembretesAvulsos.boardId, boardId),
      ),
    )
    .get();
  if (!registro) {
    throw new ErroApp(mensagens.lembreteAvulsoInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGO_LEMBRETE_AVULSO_INEXISTENTE,
    });
  }
  exigirVersaoEsperada(
    registro.versao,
    versaoEsperada,
    mensagens.lembreteAvulsoAlterado,
  );
  return registro;
}

const PENDENTE_SEM_DISPARO = {
  situacao: 'pendente',
  disparadoEm: null,
  dispensadoEm: null,
} as const;

export function criarLembreteAvulso(
  banco: BancoDados,
  novo: NovoLembreteAvulso,
  agora: Date = new Date(),
): { lembreteId: number } {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const criado = transacao
      .insert(lembretesAvulsos)
      .values({
        boardId: board.id,
        titulo: novo.titulo,
        observacao: novo.observacao,
        lembreteEm: converterInstanteFuturo(
          board,
          novo.lembreteData,
          novo.lembreteHora,
          agora,
        ),
        ...PENDENTE_SEM_DISPARO,
      })
      .returning({ id: lembretesAvulsos.id })
      .get();
    return { lembreteId: criado.id };
  }, TRANSACAO_ESCRITA);
}

// Editar remarca: o lembrete volta a pendente no novo horário (mesmo que já
// tenha disparado ou sido cancelado), e dispara de novo uma única vez.
export function editarLembreteAvulso(
  banco: BancoDados,
  edicao: EdicaoLembreteAvulso,
  agora: Date = new Date(),
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    exigirLembreteNaVersao(
      transacao,
      board.id,
      edicao.lembreteId,
      edicao.versaoEsperada,
    );
    transacao
      .update(lembretesAvulsos)
      .set({
        titulo: edicao.titulo,
        observacao: edicao.observacao,
        lembreteEm: converterInstanteFuturo(
          board,
          edicao.lembreteData,
          edicao.lembreteHora,
          agora,
        ),
        ...PENDENTE_SEM_DISPARO,
        versao: sql`${lembretesAvulsos.versao} + 1`,
      })
      .where(eq(lembretesAvulsos.id, edicao.lembreteId))
      .run();
  }, TRANSACAO_ESCRITA);
}

export function cancelarLembreteAvulso(
  banco: BancoDados,
  alteracao: AlteracaoLembreteAvulso,
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = exigirLembreteNaVersao(
      transacao,
      board.id,
      alteracao.lembreteId,
      alteracao.versaoEsperada,
    );
    if (atual.situacao === 'cancelado') {
      return;
    }
    if (atual.situacao === 'disparado') {
      throw erroConflito(
        mensagens.lembreteJaDisparado,
        CODIGOS_LEMBRETE.JA_DISPARADO,
      );
    }
    transacao
      .update(lembretesAvulsos)
      .set({
        situacao: 'cancelado',
        versao: sql`${lembretesAvulsos.versao} + 1`,
      })
      .where(eq(lembretesAvulsos.id, atual.id))
      .run();
  }, TRANSACAO_ESCRITA);
}

// Como no lembrete de atividade, reativar não dispara na hora um aviso cujo
// horário já passou: nesse caso é preciso remarcar.
export function reativarLembreteAvulso(
  banco: BancoDados,
  alteracao: AlteracaoLembreteAvulso,
  agora: Date = new Date(),
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = exigirLembreteNaVersao(
      transacao,
      board.id,
      alteracao.lembreteId,
      alteracao.versaoEsperada,
    );
    if (atual.situacao === 'pendente') {
      return;
    }
    if (new Date(atual.lembreteEm).getTime() <= agora.getTime()) {
      throw erroConflito(mensagens.lembreteVencido, CODIGOS_LEMBRETE.VENCIDO);
    }
    transacao
      .update(lembretesAvulsos)
      .set({
        ...PENDENTE_SEM_DISPARO,
        versao: sql`${lembretesAvulsos.versao} + 1`,
      })
      .where(eq(lembretesAvulsos.id, atual.id))
      .run();
  }, TRANSACAO_ESCRITA);
}

export function excluirLembreteAvulso(
  banco: BancoDados,
  alteracao: AlteracaoLembreteAvulso,
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = exigirLembreteNaVersao(
      transacao,
      board.id,
      alteracao.lembreteId,
      alteracao.versaoEsperada,
    );
    transacao
      .delete(lembretesAvulsos)
      .where(eq(lembretesAvulsos.id, atual.id))
      .run();
  }, TRANSACAO_ESCRITA);
}

function montarNotificacao(
  registro: Pick<
    LembreteAvulsoRegistro,
    'id' | 'titulo' | 'observacao' | 'lembreteEm'
  >,
  disparadoEm: string,
): NotificacaoLembreteAvulso {
  const limiteSemAtraso = somarMinutos(
    new Date(registro.lembreteEm),
    LEMBRETES.TOLERANCIA_ATRASO_MINUTOS,
  );
  return {
    lembreteId: registro.id,
    titulo: registro.titulo,
    observacao: registro.observacao,
    lembreteEm: registro.lembreteEm,
    disparadoEm,
    atrasado: new Date(disparadoEm).getTime() > limiteSemAtraso.getTime(),
  };
}

// Mesma garantia dos lembretes de atividade: a troca para disparado é
// condicional (situação e instante no WHERE) dentro de uma transação
// IMMEDIATE, então duas abas não disparam o mesmo aviso duas vezes.
export function dispararLembretesAvulsosVencidos(
  banco: BancoDados,
  agora: Date = new Date(),
): NotificacaoLembreteAvulso[] {
  return banco.transaction((transacao) => {
    const board = buscarBoardPadrao(transacao);
    if (!board) {
      return [];
    }
    const disparadoEm = agora.toISOString();
    const vencidos = transacao
      .select()
      .from(lembretesAvulsos)
      .where(
        and(
          eq(lembretesAvulsos.boardId, board.id),
          eq(lembretesAvulsos.situacao, 'pendente'),
          lte(lembretesAvulsos.lembreteEm, disparadoEm),
        ),
      )
      .orderBy(asc(lembretesAvulsos.lembreteEm))
      .all();
    return vencidos.flatMap((registro) => {
      const resultado = transacao
        .update(lembretesAvulsos)
        .set({
          situacao: 'disparado',
          disparadoEm,
          ...PRESERVAR_ATUALIZADO_EM,
        })
        .where(
          and(
            eq(lembretesAvulsos.id, registro.id),
            eq(lembretesAvulsos.situacao, 'pendente'),
            eq(lembretesAvulsos.lembreteEm, registro.lembreteEm),
          ),
        )
        .run();
      return resultado.changes === 1
        ? [montarNotificacao(registro, disparadoEm)]
        : [];
    });
  }, TRANSACAO_ESCRITA);
}

export function listarLembretesAvulsosADispensar(
  executor: ExecutorBanco,
): NotificacaoLembreteAvulso[] {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return [];
  }
  return executor
    .select()
    .from(lembretesAvulsos)
    .where(
      and(
        eq(lembretesAvulsos.boardId, board.id),
        eq(lembretesAvulsos.situacao, 'disparado'),
        isNotNull(lembretesAvulsos.disparadoEm),
        isNull(lembretesAvulsos.dispensadoEm),
      ),
    )
    .orderBy(desc(lembretesAvulsos.disparadoEm), desc(lembretesAvulsos.id))
    .limit(LEMBRETES.MAXIMO_NOTIFICACOES_LISTADAS)
    .all()
    .flatMap((registro) =>
      registro.disparadoEm === null
        ? []
        : [montarNotificacao(registro, registro.disparadoEm)],
    );
}

// Idempotente, como no lembrete de atividade: dispensar de novo ou dispensar
// um disparo já substituído por outro horário não altera nada.
export function dispensarLembreteAvulso(
  banco: BancoDados,
  dispensa: DispensaLembreteAvulso,
  agora: Date = new Date(),
): boolean {
  const resultado = banco
    .update(lembretesAvulsos)
    .set({ dispensadoEm: agora.toISOString(), ...PRESERVAR_ATUALIZADO_EM })
    .where(
      and(
        eq(lembretesAvulsos.id, dispensa.lembreteId),
        eq(lembretesAvulsos.situacao, 'disparado'),
        eq(lembretesAvulsos.lembreteEm, dispensa.lembreteEm),
        isNotNull(lembretesAvulsos.disparadoEm),
        isNull(lembretesAvulsos.dispensadoEm),
      ),
    )
    .run();
  return resultado.changes === 1;
}

export function listarProximosLembretesAvulsos(
  executor: ExecutorBanco,
  depoisDe: Date,
  limite: number,
): LembreteAvulso[] {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return [];
  }
  return executor
    .select()
    .from(lembretesAvulsos)
    .where(
      and(
        eq(lembretesAvulsos.boardId, board.id),
        eq(lembretesAvulsos.situacao, 'pendente'),
        gt(lembretesAvulsos.lembreteEm, depoisDe.toISOString()),
      ),
    )
    .orderBy(asc(lembretesAvulsos.lembreteEm))
    .limit(limite)
    .all()
    .map(converterRegistro);
}

// Todos os lembretes avulsos, para a página de gestão: pendentes primeiro
// (pelo horário), depois disparados e cancelados (mais recentes antes).
export function listarLembretesAvulsos(
  executor: ExecutorBanco,
): LembreteAvulso[] {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return [];
  }
  const ordemSituacao = sql`CASE ${lembretesAvulsos.situacao} WHEN 'pendente' THEN 0 WHEN 'disparado' THEN 1 ELSE 2 END`;
  return executor
    .select()
    .from(lembretesAvulsos)
    .where(eq(lembretesAvulsos.boardId, board.id))
    .orderBy(
      ordemSituacao,
      sql`CASE WHEN ${lembretesAvulsos.situacao} = 'pendente' THEN ${lembretesAvulsos.lembreteEm} END ASC`,
      desc(lembretesAvulsos.lembreteEm),
    )
    .all()
    .map(converterRegistro);
}
