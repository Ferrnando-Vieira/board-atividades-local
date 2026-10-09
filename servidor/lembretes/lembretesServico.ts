import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { LEMBRETES, type SituacaoLembrete } from '@/config/constantes';
import { exigirVersaoEsperada } from '@/servidor/banco/concorrencia';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { atividades } from '@/servidor/banco/esquema';
import {
  exigirAtividadeAtiva,
  incrementarVersaoAtividade,
  type AtividadeRegistro,
} from '@/servidor/atividades/atividadesRepositorio';
import { mensagensAtividades } from '@/servidor/atividades/mensagensAtividades';
import {
  buscarBoardPadrao,
  exigirBoardPadrao,
  type BoardResumo,
} from '@/servidor/board/boardRepositorio';
import type {
  AlteracaoLembrete,
  DefinicaoLembrete,
  DispensaLembrete,
} from '@/servidor/lembretes/esquemasLembretes';
import {
  listarLembretesPendentes,
  type LembretePendente,
} from '@/servidor/lembretes/lembretesRepositorio';
import { mensagensLembretes as mensagens } from '@/servidor/lembretes/mensagensLembretes';
import { converterHorarioLocalParaUtc, somarMinutos } from '@/util/DataUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

export const CODIGOS_LEMBRETE = {
  NO_PASSADO: 'lembrete-no-passado',
  INEXISTENTE: 'lembrete-inexistente',
  VENCIDO: 'lembrete-vencido',
  JA_DISPARADO: 'lembrete-ja-disparado',
} as const;

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

export type LembreteGravado = {
  atividadeId: number;
  versao: number;
};

export type NotificacaoLembrete = {
  atividadeId: number;
  titulo: string;
  lembreteEm: string;
  disparadoEm: string;
  atrasado: boolean;
};

export type SincronizacaoLembretes = {
  novas: NotificacaoLembrete[];
  aDispensar: NotificacaoLembrete[];
};

type ValoresLembrete = {
  lembreteEm: string | null;
  lembreteSituacao: SituacaoLembrete | null;
  lembreteDisparadoEm: string | null;
  lembreteDispensadoEm: string | null;
};

type AlteracaoIniciada = {
  board: BoardResumo;
  atual: AtividadeRegistro;
};

const LEMBRETE_AUSENTE: ValoresLembrete = {
  lembreteEm: null,
  lembreteSituacao: null,
  lembreteDisparadoEm: null,
  lembreteDispensadoEm: null,
};

// Disparar e dispensar mudam o estado do aviso, não a atividade: a versão e
// o "atualizado em" ficam como estavam, para não invalidar um formulário de
// edição aberto nem sugerir que alguém editou o cartão.
const PRESERVAR_ATUALIZADO_EM = {
  atualizadoEm: sql`${atividades.atualizadoEm}`,
};

function erroConflito(mensagem: string, codigo: string): ErroApp {
  return new ErroApp(mensagem, { status: STATUS_ERRO.CONFLITO, codigo });
}

// Criar, editar, ativar, desativar e excluir são edições da atividade: valem
// só para atividade ativa e exigem a versão que o formulário viu.
function iniciarAlteracao(
  transacao: ExecutorBanco,
  atividadeId: number,
  versaoEsperada: number,
): AlteracaoIniciada {
  const board = exigirBoardPadrao(transacao);
  const atual = exigirAtividadeAtiva(transacao, board.id, atividadeId);
  exigirVersaoEsperada(
    atual.versao,
    versaoEsperada,
    mensagensAtividades.atividadeAlterada,
  );
  return { board, atual };
}

function exigirLembrete(atual: AtividadeRegistro): string {
  if (atual.lembreteEm === null) {
    throw erroConflito(
      mensagens.lembreteInexistente,
      CODIGOS_LEMBRETE.INEXISTENTE,
    );
  }
  return atual.lembreteEm;
}

function gravarLembrete(
  transacao: ExecutorBanco,
  atual: AtividadeRegistro,
  valores: ValoresLembrete,
): LembreteGravado {
  transacao
    .update(atividades)
    .set({ ...valores, versao: incrementarVersaoAtividade() })
    .where(eq(atividades.id, atual.id))
    .run();
  return { atividadeId: atual.id, versao: atual.versao + 1 };
}

function manterSemAlteracao(atual: AtividadeRegistro): LembreteGravado {
  return { atividadeId: atual.id, versao: atual.versao };
}

function ehFuturo(instanteIso: string, agora: Date): boolean {
  return new Date(instanteIso).getTime() > agora.getTime();
}

function lembretePendente(lembreteEm: string): ValoresLembrete {
  return { ...LEMBRETE_AUSENTE, lembreteEm, lembreteSituacao: 'pendente' };
}

// Remarcar volta o lembrete a pendente e apaga o disparo anterior: o novo
// instante é outro aviso, que dispara de novo uma única vez.
export function definirLembrete(
  banco: BancoDados,
  definicao: DefinicaoLembrete,
  agora: Date = new Date(),
): LembreteGravado {
  return banco.transaction((transacao) => {
    const { board, atual } = iniciarAlteracao(
      transacao,
      definicao.atividadeId,
      definicao.versaoEsperada,
    );
    const instante = converterHorarioLocalParaUtc(
      definicao.lembreteData,
      definicao.lembreteHora,
      board.fusoHorario,
    ).toISOString();
    if (!ehFuturo(instante, agora)) {
      throw new ErroApp(mensagens.lembreteNoPassado, {
        status: STATUS_ERRO.REQUISICAO_INVALIDA,
        codigo: CODIGOS_LEMBRETE.NO_PASSADO,
      });
    }
    return gravarLembrete(transacao, atual, lembretePendente(instante));
  }, TRANSACAO_ESCRITA);
}

// Reativar não dispara na hora um aviso cujo horário já passou: o usuário
// escolhe uma nova data, para o lembrete não virar um alarme atrasado.
export function ativarLembrete(
  banco: BancoDados,
  alteracao: AlteracaoLembrete,
  agora: Date = new Date(),
): LembreteGravado {
  return banco.transaction((transacao) => {
    const { atual } = iniciarAlteracao(
      transacao,
      alteracao.atividadeId,
      alteracao.versaoEsperada,
    );
    const lembreteEm = exigirLembrete(atual);
    if (atual.lembreteSituacao === 'pendente') {
      return manterSemAlteracao(atual);
    }
    if (!ehFuturo(lembreteEm, agora)) {
      throw erroConflito(mensagens.lembreteVencido, CODIGOS_LEMBRETE.VENCIDO);
    }
    return gravarLembrete(transacao, atual, lembretePendente(lembreteEm));
  }, TRANSACAO_ESCRITA);
}

export function desativarLembrete(
  banco: BancoDados,
  alteracao: AlteracaoLembrete,
): LembreteGravado {
  return banco.transaction((transacao) => {
    const { atual } = iniciarAlteracao(
      transacao,
      alteracao.atividadeId,
      alteracao.versaoEsperada,
    );
    const lembreteEm = exigirLembrete(atual);
    if (atual.lembreteSituacao === 'cancelado') {
      return manterSemAlteracao(atual);
    }
    if (atual.lembreteSituacao === 'disparado') {
      throw erroConflito(
        mensagens.lembreteJaDisparado,
        CODIGOS_LEMBRETE.JA_DISPARADO,
      );
    }
    return gravarLembrete(transacao, atual, {
      ...LEMBRETE_AUSENTE,
      lembreteEm,
      lembreteSituacao: 'cancelado',
    });
  }, TRANSACAO_ESCRITA);
}

export function excluirLembrete(
  banco: BancoDados,
  alteracao: AlteracaoLembrete,
): LembreteGravado {
  return banco.transaction((transacao) => {
    const { atual } = iniciarAlteracao(
      transacao,
      alteracao.atividadeId,
      alteracao.versaoEsperada,
    );
    exigirLembrete(atual);
    return gravarLembrete(transacao, atual, LEMBRETE_AUSENTE);
  }, TRANSACAO_ESCRITA);
}

function montarNotificacao(
  lembrete: LembretePendente & { disparadoEm: string },
): NotificacaoLembrete {
  const limiteSemAtraso = somarMinutos(
    new Date(lembrete.lembreteEm),
    LEMBRETES.TOLERANCIA_ATRASO_MINUTOS,
  );
  return {
    atividadeId: lembrete.atividadeId,
    titulo: lembrete.titulo,
    lembreteEm: lembrete.lembreteEm,
    disparadoEm: lembrete.disparadoEm,
    atrasado:
      new Date(lembrete.disparadoEm).getTime() > limiteSemAtraso.getTime(),
  };
}

// A troca de pendente para disparado é condicional (situação e instante na
// cláusula WHERE) e acontece numa transação IMMEDIATE: duas abas ou duas
// sincronizações simultâneas não disparam o mesmo aviso duas vezes, porque
// só uma delas encontra a linha ainda pendente. Atividade arquivada não
// dispara; o lembrete volta a valer quando ela for restaurada.
export function dispararLembretesVencidos(
  banco: BancoDados,
  agora: Date = new Date(),
): NotificacaoLembrete[] {
  return banco.transaction((transacao) => {
    const disparadoEm = agora.toISOString();
    return listarLembretesPendentes(transacao, agora).flatMap((lembrete) => {
      const resultado = transacao
        .update(atividades)
        .set({
          lembreteSituacao: 'disparado',
          lembreteDisparadoEm: disparadoEm,
          ...PRESERVAR_ATUALIZADO_EM,
        })
        .where(
          and(
            eq(atividades.id, lembrete.atividadeId),
            eq(atividades.lembreteSituacao, 'pendente'),
            eq(atividades.lembreteEm, lembrete.lembreteEm),
          ),
        )
        .run();
      return resultado.changes === 1
        ? [montarNotificacao({ ...lembrete, disparadoEm })]
        : [];
    });
  }, TRANSACAO_ESCRITA);
}

// Disparados por este sistema e ainda não dispensados. Os históricos
// gravados como 'disparado' não têm momento de disparo e ficam de fora.
export function listarLembretesADispensar(
  executor: ExecutorBanco,
): NotificacaoLembrete[] {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return [];
  }
  return executor
    .select({
      atividadeId: atividades.id,
      titulo: atividades.titulo,
      lembreteEm: atividades.lembreteEm,
      disparadoEm: atividades.lembreteDisparadoEm,
    })
    .from(atividades)
    .where(
      and(
        eq(atividades.boardId, board.id),
        eq(atividades.lembreteSituacao, 'disparado'),
        isNotNull(atividades.lembreteDisparadoEm),
        isNull(atividades.lembreteDispensadoEm),
        isNull(atividades.arquivadaEm),
      ),
    )
    .orderBy(desc(atividades.lembreteDisparadoEm), desc(atividades.id))
    .limit(LEMBRETES.MAXIMO_NOTIFICACOES_LISTADAS)
    .all()
    .flatMap(({ lembreteEm, disparadoEm, ...linha }) =>
      lembreteEm === null || disparadoEm === null
        ? []
        : [montarNotificacao({ ...linha, lembreteEm, disparadoEm })],
    );
}

export function sincronizarLembretes(
  banco: BancoDados,
  agora: Date = new Date(),
): SincronizacaoLembretes {
  const novas = dispararLembretesVencidos(banco, agora);
  return { novas, aDispensar: listarLembretesADispensar(banco) };
}

// Idempotente: dispensar de novo, ou dispensar um disparo que já foi
// substituído por um novo horário, não altera nada e devolve falso.
export function dispensarLembrete(
  banco: BancoDados,
  dispensa: DispensaLembrete,
  agora: Date = new Date(),
): boolean {
  const resultado = banco
    .update(atividades)
    .set({
      lembreteDispensadoEm: agora.toISOString(),
      ...PRESERVAR_ATUALIZADO_EM,
    })
    .where(
      and(
        eq(atividades.id, dispensa.atividadeId),
        eq(atividades.lembreteSituacao, 'disparado'),
        eq(atividades.lembreteEm, dispensa.lembreteEm),
        isNotNull(atividades.lembreteDisparadoEm),
        isNull(atividades.lembreteDispensadoEm),
      ),
    )
    .run();
  return resultado.changes === 1;
}
