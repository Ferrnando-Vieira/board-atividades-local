import { and, asc, desc, eq, isNotNull, sql, type SQL } from 'drizzle-orm';
import type { SituacaoLembrete } from '@/config/constantes';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import {
  atividades,
  solicitantes,
  statusBoard,
} from '@/servidor/banco/esquema';
import {
  listarAnexosDaAtividade,
  type AnexoResumo,
} from '@/servidor/anexos/consultasAnexos';
import { ORDEM_AUTOMATICA_ATIVIDADES } from '@/servidor/atividades/atividadesRepositorio';
import {
  montarCondicaoFiltro,
  type FiltroAtividades,
  type RestricaoLeitura,
} from '@/servidor/atividades/filtrosAtividades';
import {
  buscarBoardPadrao,
  listarStatusDoBoard,
} from '@/servidor/board/boardRepositorio';
import { buscarSolicitantePadrao } from '@/servidor/classificacao/classificacaoRepositorio';
import {
  agruparTagsPorAtividade,
  listarNomesTags,
  listarSolicitantesSugeridos,
  mapearSolicitantesPadraoTags,
  type TagResumo,
} from '@/servidor/classificacao/consultasClassificacao';
import {
  extrairPalavrasBusca,
  textosCorrespondemBusca,
} from '@/util/BuscaUtils';
import { obterMomentoLocal, type MomentoLocal } from '@/util/DataUtils';
import {
  compararPorConclusaoRecente,
  compararPorPrazoETitulo,
} from '@/util/OrdenacaoAtividadesUtils';

export type StatusOpcao = {
  id: number;
  nome: string;
  finalizaAtividade: boolean;
};

export type AtividadeDetalhada = {
  id: number;
  titulo: string;
  descricao: string | null;
  prioridade: number;
  versao: number;
  status: StatusOpcao;
  solicitante: string;
  tags: TagResumo[];
  prazoData: string | null;
  prazoHora: string | null;
  concluidaEmData: string | null;
  concluidaEmHora: string | null;
  lembreteEm: string | null;
  lembreteSituacao: SituacaoLembrete | null;
  lembreteDisparadoEm: string | null;
  lembreteDispensadoEm: string | null;
  arquivadaEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type DetalheAtividade = AtividadeDetalhada & {
  anexos: AnexoResumo[];
};

export type ConsultaDetalheAtividade = {
  atividade: DetalheAtividade;
  fusoHorario: string;
  momentoLocal: MomentoLocal;
};

export type AtividadeArquivada = {
  id: number;
  titulo: string;
  prioridade: number;
  versao: number;
  statusNome: string;
  solicitante: string;
  tags: TagResumo[];
  prazoData: string | null;
  prazoHora: string | null;
  arquivadaEm: string;
};

export type ConsultaArquivadas = {
  fusoHorario: string;
  atividades: AtividadeArquivada[];
};

export type ResultadoBusca = {
  id: number;
  titulo: string;
  prioridade: number;
  statusNome: string;
  solicitante: string;
  tags: TagResumo[];
  prazoData: string | null;
  prazoHora: string | null;
  arquivadaEm: string | null;
};

export type ConsultaBusca = {
  fusoHorario: string;
  resultados: ResultadoBusca[];
};

export type OpcoesFormularioAtividade = {
  status: StatusOpcao[];
  solicitantes: string[];
  // Preenche o campo de uma atividade nova; nulo quando o board não tem.
  solicitantePadrao: string | null;
  // Solicitante padrão por tag (chave normalizada do nome): o formulário
  // sugere o da primeira tag escolhida que tiver um.
  solicitantesPadraoTags: Record<string, string>;
  tags: string[];
  // Para as sugestões de data e hora do formulário, no horário do board.
  fusoHorario: string;
};

// Ativas primeiro, na ordem do quadro (posição do status e, dentro dele, a
// regra de ordenarNaColuna); arquivadas no fim, agrupadas pelo status na mesma
// ordem. O SQL só pré-ordena: o refinamento por coluna (prazo e título) roda
// em memória, com os mesmos comparadores da interface.
const ORDENACAO_ATIVIDADES = [
  sql`${atividades.arquivadaEm} is not null`,
  asc(statusBoard.posicao),
  desc(
    sql`case when ${statusBoard.finalizaAtividade} then coalesce(${atividades.concluidaEmData} || 'T' || coalesce(${atividades.concluidaEmHora}, '00:00'), '') end`,
  ),
  ...ORDEM_AUTOMATICA_ATIVIDADES,
];

type LinhaOrdenavel = {
  atividade: typeof atividades.$inferSelect;
  statusFinaliza: boolean;
  statusPosicao: number;
};

// Arquivadas no fim, depois a posição do status e, dentro dele, a regra da
// coluna (a mesma do quadro). Array.sort é estável, então o pré-ordenado do
// SQL desempata o que sobrar.
function compararLinhasNaOrdemDoQuadro(
  primeira: LinhaOrdenavel,
  segunda: LinhaOrdenavel,
): number {
  const arquivadas =
    Number(primeira.atividade.arquivadaEm !== null) -
    Number(segunda.atividade.arquivadaEm !== null);
  if (arquivadas !== 0) {
    return arquivadas;
  }
  const status = primeira.statusPosicao - segunda.statusPosicao;
  if (status !== 0) {
    return status;
  }
  return primeira.statusFinaliza
    ? compararPorConclusaoRecente(primeira.atividade, segunda.atividade)
    : compararPorPrazoETitulo(primeira.atividade, segunda.atividade);
}

function selecionarAtividadesDetalhadas(
  executor: ExecutorBanco,
  condicao: SQL | undefined,
): AtividadeDetalhada[] {
  const linhas = executor
    .select({
      atividade: atividades,
      statusNome: statusBoard.nome,
      statusFinaliza: statusBoard.finalizaAtividade,
      statusPosicao: statusBoard.posicao,
      solicitante: solicitantes.nome,
    })
    .from(atividades)
    .innerJoin(statusBoard, eq(statusBoard.id, atividades.statusId))
    .innerJoin(solicitantes, eq(solicitantes.id, atividades.solicitanteId))
    .where(condicao)
    .orderBy(...ORDENACAO_ATIVIDADES)
    .all()
    .sort(compararLinhasNaOrdemDoQuadro);
  const tagsPorAtividade = agruparTagsPorAtividade(
    executor,
    linhas.map((linha) => linha.atividade.id),
  );
  return linhas.map(
    ({ atividade, statusNome, statusFinaliza, solicitante }) => ({
      id: atividade.id,
      titulo: atividade.titulo,
      descricao: atividade.descricao,
      prioridade: atividade.prioridade,
      versao: atividade.versao,
      status: {
        id: atividade.statusId,
        nome: statusNome,
        finalizaAtividade: statusFinaliza,
      },
      solicitante,
      tags: tagsPorAtividade.get(atividade.id) ?? [],
      prazoData: atividade.prazoData,
      prazoHora: atividade.prazoHora,
      concluidaEmData: atividade.concluidaEmData,
      concluidaEmHora: atividade.concluidaEmHora,
      lembreteEm: atividade.lembreteEm,
      lembreteSituacao: atividade.lembreteSituacao,
      lembreteDisparadoEm: atividade.lembreteDisparadoEm,
      lembreteDispensadoEm: atividade.lembreteDispensadoEm,
      arquivadaEm: atividade.arquivadaEm,
      criadoEm: atividade.criadoEm,
      atualizadoEm: atividade.atualizadoEm,
    }),
  );
}

function correspondeBusca(
  atividade: AtividadeDetalhada,
  palavras: readonly string[],
): boolean {
  return textosCorrespondemBusca(
    [
      atividade.titulo,
      atividade.descricao,
      atividade.solicitante,
      ...atividade.tags.map((tag) => tag.nome),
    ],
    palavras,
  );
}

// `restricao` vem do acesso (link restrito) e `filtro` de quem consulta; as
// duas condições valem juntas, então o filtro nunca amplia o escopo.
export function listarAtividadesDetalhadas(
  executor: ExecutorBanco,
  filtro: FiltroAtividades | null,
  termo: string | null,
  restricao: RestricaoLeitura = null,
): AtividadeDetalhada[] {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return [];
  }
  const palavras = termo === null ? [] : extrairPalavrasBusca(termo);
  return selecionarAtividadesDetalhadas(
    executor,
    and(
      eq(atividades.boardId, board.id),
      montarCondicaoFiltro(filtro),
      montarCondicaoFiltro(restricao),
    ),
  ).filter((atividade) => correspondeBusca(atividade, palavras));
}

// Fora do escopo do acesso, a atividade responde como inexistente: o
// identificador digitado na URL não revela nem a existência dela.
export function consultarDetalheAtividade(
  executor: ExecutorBanco,
  atividadeId: number,
  agora: Date = new Date(),
  restricao: RestricaoLeitura = null,
): ConsultaDetalheAtividade | null {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return null;
  }
  const [atividade] = selecionarAtividadesDetalhadas(
    executor,
    and(
      eq(atividades.id, atividadeId),
      eq(atividades.boardId, board.id),
      montarCondicaoFiltro(restricao),
    ),
  );
  if (!atividade) {
    return null;
  }
  return {
    fusoHorario: board.fusoHorario,
    momentoLocal: obterMomentoLocal(agora, board.fusoHorario),
    atividade: {
      ...atividade,
      anexos: listarAnexosDaAtividade(executor, atividade.id),
    },
  };
}

export function buscarAtividades(
  executor: ExecutorBanco,
  termo: string,
  restricao: RestricaoLeitura = null,
): ConsultaBusca | null {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return null;
  }
  if (extrairPalavrasBusca(termo).length === 0) {
    return { fusoHorario: board.fusoHorario, resultados: [] };
  }
  return {
    fusoHorario: board.fusoHorario,
    resultados: listarAtividadesDetalhadas(
      executor,
      null,
      termo,
      restricao,
    ).map((atividade) => ({
      id: atividade.id,
      titulo: atividade.titulo,
      prioridade: atividade.prioridade,
      statusNome: atividade.status.nome,
      solicitante: atividade.solicitante,
      tags: atividade.tags,
      prazoData: atividade.prazoData,
      prazoHora: atividade.prazoHora,
      arquivadaEm: atividade.arquivadaEm,
    })),
  };
}

export function listarAtividadesArquivadas(
  executor: ExecutorBanco,
  restricao: RestricaoLeitura = null,
): ConsultaArquivadas | null {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return null;
  }
  const linhas = executor
    .select({
      id: atividades.id,
      titulo: atividades.titulo,
      prioridade: atividades.prioridade,
      versao: atividades.versao,
      statusNome: statusBoard.nome,
      solicitante: solicitantes.nome,
      prazoData: atividades.prazoData,
      prazoHora: atividades.prazoHora,
      arquivadaEm: atividades.arquivadaEm,
    })
    .from(atividades)
    .innerJoin(statusBoard, eq(statusBoard.id, atividades.statusId))
    .innerJoin(solicitantes, eq(solicitantes.id, atividades.solicitanteId))
    .where(
      and(
        eq(atividades.boardId, board.id),
        isNotNull(atividades.arquivadaEm),
        montarCondicaoFiltro(restricao),
      ),
    )
    .orderBy(desc(atividades.arquivadaEm), desc(atividades.id))
    .all();
  const tagsPorAtividade = agruparTagsPorAtividade(
    executor,
    linhas.map((linha) => linha.id),
  );
  return {
    fusoHorario: board.fusoHorario,
    atividades: linhas.flatMap((linha) =>
      linha.arquivadaEm === null
        ? []
        : [
            {
              ...linha,
              arquivadaEm: linha.arquivadaEm,
              tags: tagsPorAtividade.get(linha.id) ?? [],
            },
          ],
    ),
  };
}

export function consultarOpcoesFormularioAtividade(
  executor: ExecutorBanco,
): OpcoesFormularioAtividade | null {
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return null;
  }
  return {
    status: listarStatusDoBoard(executor, board.id).map((status) => ({
      id: status.id,
      nome: status.nome,
      finalizaAtividade: status.finalizaAtividade,
    })),
    solicitantes: listarSolicitantesSugeridos(executor, board.id),
    solicitantePadrao:
      buscarSolicitantePadrao(executor, board.id)?.nome ?? null,
    solicitantesPadraoTags: mapearSolicitantesPadraoTags(executor, board.id),
    tags: listarNomesTags(executor, board.id),
    fusoHorario: board.fusoHorario,
  };
}
