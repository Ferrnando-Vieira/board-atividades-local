import { and, count, eq, isNotNull, sql } from 'drizzle-orm';
import {
  exigirOrdemEsperada,
  exigirVersaoEsperada,
} from '@/servidor/banco/concorrencia';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import {
  atividades,
  escopoLinkStatus,
  statusBoard,
} from '@/servidor/banco/esquema';
import {
  extrairConclusao,
  gravarOrdemDoStatus,
  incrementarVersaoAtividade,
  listarIdsAtivosDoStatus,
} from '@/servidor/atividades/atividadesRepositorio';
import { definirConclusaoDoMovimento } from '@/servidor/atividades/regrasConclusao';
import {
  CODIGO_STATUS_INEXISTENTE,
  exigirBoardPadrao,
  exigirStatusDoBoard,
  listarStatusDoBoard,
  type StatusResumo,
} from '@/servidor/board/boardRepositorio';
import type {
  DadosEdicaoStatus,
  DadosExclusaoStatus,
  DadosNovoStatus,
  MovimentoStatusPorPosicao,
  ReordenacaoStatus,
} from '@/servidor/board/esquemasStatus';
import { mensagensStatus as mensagens } from '@/servidor/board/mensagensStatus';
import { obterMomentoLocal, type MomentoLocal } from '@/util/DataUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { listasIguais, moverParaPosicao, removerItem } from '@/util/ListaUtils';
import { gerarChaveNormalizada } from '@/util/NormalizacaoUtils';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;
const CHAVE_STATUS_PADRAO = 'status';
const CARACTERES_FORA_DA_CHAVE = /[^a-z0-9]+/g;
const HIFENS_NAS_PONTAS = /^-+|-+$/g;
const PRIMEIRO_SUFIXO_CHAVE = 2;

export const CODIGO_NOME_STATUS_REPETIDO = 'nome-status-repetido';
export const CODIGO_ULTIMO_STATUS = 'ultimo-status';
export const CODIGO_DESTINO_OBRIGATORIO = 'destino-obrigatorio';
export const CODIGO_DESTINO_INVALIDO = 'destino-invalido';
export const CODIGO_STATUS_COMPARTILHADO = 'status-em-compartilhamento';

export type ResultadoExclusaoStatus = {
  atividadesMovidas: number;
};

function criarErro(mensagem: string, status: number, codigo: string): ErroApp {
  return new ErroApp(mensagem, { status, codigo });
}

// A unicidade ignora caixa e acento, como tags e solicitantes, para não
// existir "Concluídos" e "concluidos" lado a lado no board.
function exigirNomeDisponivel(
  existentes: readonly StatusResumo[],
  nome: string,
  statusIgnoradoId: number | null,
): void {
  const chave = gerarChaveNormalizada(nome);
  const repetido = existentes.some(
    (status) =>
      status.id !== statusIgnoradoId &&
      gerarChaveNormalizada(status.nome) === chave,
  );
  if (repetido) {
    throw criarErro(
      mensagens.nomeRepetido,
      STATUS_ERRO.CONFLITO,
      CODIGO_NOME_STATUS_REPETIDO,
    );
  }
}

// A chave é estável (não muda ao renomear) e identifica os status iniciais
// mesmo depois de renomeados.
function gerarChaveStatus(nome: string, chavesEmUso: ReadonlySet<string>) {
  const base =
    gerarChaveNormalizada(nome)
      .replace(CARACTERES_FORA_DA_CHAVE, '-')
      .replace(HIFENS_NAS_PONTAS, '') || CHAVE_STATUS_PADRAO;
  let chave = base;
  for (
    let sufixo = PRIMEIRO_SUFIXO_CHAVE;
    chavesEmUso.has(chave);
    sufixo += 1
  ) {
    chave = `${base}-${sufixo}`;
  }
  return chave;
}

function exigirStatusListado(
  existentes: readonly StatusResumo[],
  statusId: number,
): StatusResumo {
  const status = existentes.find((item) => item.id === statusId);
  if (!status) {
    throw criarErro(
      mensagens.statusInexistente,
      STATUS_ERRO.NAO_ENCONTRADO,
      CODIGO_STATUS_INEXISTENTE,
    );
  }
  return status;
}

// Mesma técnica da ordem das atividades: a posição é única por board e o
// SQLite não adia UNIQUE, então tudo passa antes por uma faixa livre.
function gravarPosicoesDosStatus(
  executor: ExecutorBanco,
  boardId: number,
  existentes: readonly StatusResumo[],
  idsEmOrdem: readonly number[],
): void {
  const maiorPosicao = Math.max(...existentes.map((status) => status.posicao));
  const deslocamento = maiorPosicao + idsEmOrdem.length + 1;
  executor
    .update(statusBoard)
    .set({ posicao: sql`${statusBoard.posicao} + ${deslocamento}` })
    .where(eq(statusBoard.boardId, boardId))
    .run();
  idsEmOrdem.forEach((statusId, posicao) => {
    executor
      .update(statusBoard)
      .set({ posicao })
      .where(eq(statusBoard.id, statusId))
      .run();
  });
}

export function criarStatus(
  banco: BancoDados,
  dados: DadosNovoStatus,
): { statusId: number } {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const existentes = listarStatusDoBoard(transacao, board.id);
    exigirNomeDisponivel(existentes, dados.nome, null);
    const ultimaPosicao = existentes.at(-1)?.posicao ?? -1;
    const criado = transacao
      .insert(statusBoard)
      .values({
        boardId: board.id,
        chave: gerarChaveStatus(
          dados.nome,
          new Set(existentes.map((status) => status.chave)),
        ),
        nome: dados.nome,
        posicao: ultimaPosicao + 1,
        finalizaAtividade: dados.finalizaAtividade,
        corTitulo: dados.corTitulo,
        corColuna: dados.corColuna,
      })
      .returning({ id: statusBoard.id })
      .get();
    return { statusId: criado.id };
  }, TRANSACAO_ESCRITA);
}

// Mudar "conclui a atividade" não reescreve as atividades que já estão no
// status: a regra de conclusão vale a partir dos próximos movimentos.
export function editarStatus(
  banco: BancoDados,
  dados: DadosEdicaoStatus,
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const existentes = listarStatusDoBoard(transacao, board.id);
    const atual = exigirStatusListado(existentes, dados.statusId);
    exigirVersaoEsperada(
      atual.versao,
      dados.versaoEsperada,
      mensagens.statusAlterado,
    );
    exigirNomeDisponivel(existentes, dados.nome, atual.id);
    transacao
      .update(statusBoard)
      .set({
        nome: dados.nome,
        finalizaAtividade: dados.finalizaAtividade,
        corTitulo: dados.corTitulo,
        corColuna: dados.corColuna,
        versao: sql`${statusBoard.versao} + 1`,
      })
      .where(eq(statusBoard.id, atual.id))
      .run();
  }, TRANSACAO_ESCRITA);
}

export function reordenarStatus(
  banco: BancoDados,
  reordenacao: ReordenacaoStatus,
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const existentes = listarStatusDoBoard(transacao, board.id);
    exigirStatusListado(existentes, reordenacao.statusId);
    const ordemGravada = existentes.map((status) => status.id);
    exigirOrdemEsperada(
      removerItem(ordemGravada, reordenacao.statusId),
      removerItem(reordenacao.ordemNova, reordenacao.statusId),
      mensagens.ordemAlterada,
    );
    if (!listasIguais(ordemGravada, reordenacao.ordemNova)) {
      gravarPosicoesDosStatus(
        transacao,
        board.id,
        existentes,
        reordenacao.ordemNova,
      );
    }
  }, TRANSACAO_ESCRITA);
}

// Para a API: a nova ordem é montada dentro da transação a partir da gravada,
// então não existe visão desatualizada do cliente a conferir.
export function moverStatusParaPosicao(
  banco: BancoDados,
  movimento: MovimentoStatusPorPosicao,
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const existentes = listarStatusDoBoard(transacao, board.id);
    exigirStatusListado(existentes, movimento.statusId);
    const ordemGravada = existentes.map((status) => status.id);
    const ordemNova = moverParaPosicao(
      ordemGravada,
      movimento.statusId,
      movimento.posicao,
    );
    if (!listasIguais(ordemGravada, ordemNova)) {
      gravarPosicoesDosStatus(transacao, board.id, existentes, ordemNova);
    }
  }, TRANSACAO_ESCRITA);
}

function exigirForaDeCompartilhamento(
  executor: ExecutorBanco,
  statusId: number,
): void {
  const vinculos =
    executor
      .select({ quantidade: count() })
      .from(escopoLinkStatus)
      .where(eq(escopoLinkStatus.statusId, statusId))
      .get()?.quantidade ?? 0;
  if (vinculos > 0) {
    throw criarErro(
      mensagens.usadoEmCompartilhamento,
      STATUS_ERRO.CONFLITO,
      CODIGO_STATUS_COMPARTILHADO,
    );
  }
}

function exigirDestino(
  executor: ExecutorBanco,
  boardId: number,
  origem: StatusResumo,
  statusDestinoId: number | null,
): StatusResumo {
  if (statusDestinoId === null) {
    throw criarErro(
      mensagens.destinoObrigatorio,
      STATUS_ERRO.REQUISICAO_INVALIDA,
      CODIGO_DESTINO_OBRIGATORIO,
    );
  }
  if (statusDestinoId === origem.id) {
    throw criarErro(
      mensagens.destinoInvalido,
      STATUS_ERRO.REQUISICAO_INVALIDA,
      CODIGO_DESTINO_INVALIDO,
    );
  }
  return exigirStatusDoBoard(executor, boardId, statusDestinoId);
}

// Ativas entram no fim do destino, na ordem em que estavam; arquivadas só
// trocam de status. Nenhuma atividade é apagada, e cada uma segue a mesma
// regra de conclusão de um movimento comum.
function transferirAtividades(
  executor: ExecutorBanco,
  origem: StatusResumo,
  destino: StatusResumo,
  momentoAtual: MomentoLocal,
): number {
  const transferidas = executor
    .select({
      id: atividades.id,
      concluidaEmData: atividades.concluidaEmData,
      concluidaEmHora: atividades.concluidaEmHora,
    })
    .from(atividades)
    .where(eq(atividades.statusId, origem.id))
    .all();
  gravarOrdemDoStatus(executor, destino.id, [
    ...listarIdsAtivosDoStatus(executor, destino.id),
    ...listarIdsAtivosDoStatus(executor, origem.id),
  ]);
  executor
    .update(atividades)
    .set({ statusId: destino.id })
    .where(
      and(
        eq(atividades.statusId, origem.id),
        isNotNull(atividades.arquivadaEm),
      ),
    )
    .run();
  for (const atividade of transferidas) {
    executor
      .update(atividades)
      .set({
        ...definirConclusaoDoMovimento(
          destino.finalizaAtividade,
          true,
          extrairConclusao(atividade),
          momentoAtual,
        ),
        versao: incrementarVersaoAtividade(),
      })
      .where(eq(atividades.id, atividade.id))
      .run();
  }
  return transferidas.length;
}

function contarAtividadesDoStatus(
  executor: ExecutorBanco,
  statusId: number,
): number {
  return (
    executor
      .select({ quantidade: count() })
      .from(atividades)
      .where(eq(atividades.statusId, statusId))
      .get()?.quantidade ?? 0
  );
}

export function excluirStatus(
  banco: BancoDados,
  dados: DadosExclusaoStatus,
  agora: Date = new Date(),
): ResultadoExclusaoStatus {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const existentes = listarStatusDoBoard(transacao, board.id);
    const origem = exigirStatusListado(existentes, dados.statusId);
    exigirVersaoEsperada(
      origem.versao,
      dados.versaoEsperada,
      mensagens.statusAlterado,
    );
    if (existentes.length === 1) {
      throw criarErro(
        mensagens.ultimoStatus,
        STATUS_ERRO.CONFLITO,
        CODIGO_ULTIMO_STATUS,
      );
    }
    exigirForaDeCompartilhamento(transacao, origem.id);
    let atividadesMovidas = 0;
    if (contarAtividadesDoStatus(transacao, origem.id) > 0) {
      const destino = exigirDestino(
        transacao,
        board.id,
        origem,
        dados.statusDestinoId,
      );
      atividadesMovidas = transferirAtividades(
        transacao,
        origem,
        destino,
        obterMomentoLocal(agora, board.fusoHorario),
      );
    }
    transacao.delete(statusBoard).where(eq(statusBoard.id, origem.id)).run();
    return { atividadesMovidas };
  }, TRANSACAO_ESCRITA);
}
