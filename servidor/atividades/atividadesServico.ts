import { and, eq } from 'drizzle-orm';
import { LIMITES_COLECAO } from '@/config/constantes';
import {
  executarComArquivosPendentes,
  mapearAnexosPorChave,
  vincularArquivosPreparados,
  type ArquivoPreparado,
  type ArquivosPendentes,
} from '@/servidor/anexos/anexosServico';
import {
  exigirOrdemEsperada,
  exigirVersaoEsperada,
} from '@/servidor/banco/concorrencia';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { atividades, atividadesTags } from '@/servidor/banco/esquema';
import {
  calcularProximaOrdem,
  CODIGO_ATIVIDADE_NAO_ARQUIVADA,
  exigirAtividade,
  exigirAtividadeAtiva,
  extrairConclusao,
  gravarOrdemDoStatus,
  incrementarVersaoAtividade,
  listarIdsAtivosDoStatus,
  listarIdsTagsDaAtividade,
  ordenarTagsPorVinculo,
  sincronizarTagsDaAtividade,
} from '@/servidor/atividades/atividadesRepositorio';
import type {
  AlteracaoArquivamento,
  DadosAtividade,
  DadosEdicaoAtividade,
  DesvinculoTag,
  MovimentoAtividade,
  MovimentoPorPosicao,
  VinculoTag,
} from '@/servidor/atividades/esquemasAtividades';
import { mensagensAtividades as mensagens } from '@/servidor/atividades/mensagensAtividades';
import {
  definirConclusaoDoFormulario,
  definirConclusaoDoMovimento,
} from '@/servidor/atividades/regrasConclusao';
import {
  exigirBoardPadrao,
  exigirStatusDoBoard,
} from '@/servidor/board/boardRepositorio';
import {
  garantirSolicitanteOuPadrao,
  garantirTag,
} from '@/servidor/classificacao/classificacaoRepositorio';
import {
  capturarEstadoHistorico,
  registrarAlteracoesAtividade,
  registrarEventoHistorico,
} from '@/servidor/historico/historicoRepositorio';
import {
  ORIGEM_SISTEMA,
  type OrigemAlteracao,
} from '@/servidor/historico/origemAlteracao';
import { obterMomentoLocal } from '@/util/DataUtils';
import { substituirReferenciasAnexosNovos } from '@/util/DescricaoUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { listasIguais, moverParaPosicao, removerItem } from '@/util/ListaUtils';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

export type AtividadeGravada = {
  atividadeId: number;
  versao: number;
};

// Os anexos e as imagens coladas na descrição entram na mesma transação da
// atividade: o metadado de cada arquivo é gravado e cada "anexo-novo:CHAVE"
// da descrição passa a apontar para o anexo gravado ("anexo:ID"). A troca
// nunca aumenta o texto, então o limite da descrição continua valendo.
function vincularArquivosDaAtividade(
  transacao: ExecutorBanco,
  atividadeId: number,
  descricao: string | null,
  preparados: readonly ArquivoPreparado[],
  origem: OrigemAlteracao,
  agora: Date,
): void {
  const vinculados = vincularArquivosPreparados(
    transacao,
    atividadeId,
    preparados,
    origem,
    agora,
  );
  if (descricao === null || vinculados.length === 0) {
    return;
  }
  const descricaoFinal = substituirReferenciasAnexosNovos(
    descricao,
    mapearAnexosPorChave(vinculados),
  );
  if (descricaoFinal !== descricao) {
    transacao
      .update(atividades)
      .set({ descricao: descricaoFinal })
      .where(eq(atividades.id, atividadeId))
      .run();
  }
}

// A posição no quadro é automática (ORDEM_AUTOMATICA_ATIVIDADES); a coluna
// `ordem` recebe o fim da coluna só para manter o índice único por status.
export function criarAtividade(
  banco: BancoDados,
  dados: DadosAtividade,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
  arquivos: ArquivosPendentes | null = null,
): AtividadeGravada {
  return executarComArquivosPendentes(arquivos, (preparados) =>
    banco.transaction((transacao) => {
      const board = exigirBoardPadrao(transacao);
      const status = exigirStatusDoBoard(transacao, board.id, dados.statusId);
      const solicitante = garantirSolicitanteOuPadrao(
        transacao,
        board.id,
        dados.solicitante,
        dados.tags,
      );
      const conclusao = definirConclusaoDoFormulario(
        status.finalizaAtividade,
        extrairConclusao(dados),
        obterMomentoLocal(agora, board.fusoHorario),
      );
      const criada = transacao
        .insert(atividades)
        .values({
          boardId: board.id,
          statusId: status.id,
          solicitanteId: solicitante.id,
          titulo: dados.titulo,
          descricao: dados.descricao,
          prioridade: dados.prioridade,
          ordem: calcularProximaOrdem(transacao, status.id),
          prazoData: dados.prazoData,
          prazoHora: dados.prazoHora,
          ...conclusao,
        })
        .returning({ id: atividades.id, versao: atividades.versao })
        .get();
      sincronizarTagsDaAtividade(transacao, board.id, criada.id, dados.tags);
      registrarEventoHistorico(transacao, {
        atividadeId: criada.id,
        tipo: 'criacao',
        origem,
        agora,
      });
      vincularArquivosDaAtividade(
        transacao,
        criada.id,
        dados.descricao,
        preparados,
        origem,
        agora,
      );
      return { atividadeId: criada.id, versao: criada.versao };
    }, TRANSACAO_ESCRITA),
  );
}

// O lembrete não faz parte do formulário nesta etapa e é preservado como
// está. A data de criação nunca é alterada: ela define a posição no quadro.
export function editarAtividade(
  banco: BancoDados,
  dados: DadosEdicaoAtividade,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
  arquivos: ArquivosPendentes | null = null,
): AtividadeGravada {
  return executarComArquivosPendentes(arquivos, (preparados) =>
    banco.transaction((transacao) => {
      const board = exigirBoardPadrao(transacao);
      const atual = exigirAtividadeAtiva(
        transacao,
        board.id,
        dados.atividadeId,
      );
      exigirVersaoEsperada(
        atual.versao,
        dados.versaoEsperada,
        mensagens.atividadeAlterada,
      );
      const antes = capturarEstadoHistorico(transacao, atual.id);
      const status = exigirStatusDoBoard(transacao, board.id, dados.statusId);
      const mudouStatus = status.id !== atual.statusId;
      const solicitante = garantirSolicitanteOuPadrao(
        transacao,
        board.id,
        dados.solicitante,
        ordenarTagsPorVinculo(transacao, atual.id, dados.tags),
      );
      transacao
        .update(atividades)
        .set({
          statusId: status.id,
          ordem: mudouStatus
            ? calcularProximaOrdem(transacao, status.id)
            : atual.ordem,
          solicitanteId: solicitante.id,
          titulo: dados.titulo,
          descricao: dados.descricao,
          prioridade: dados.prioridade,
          prazoData: dados.prazoData,
          prazoHora: dados.prazoHora,
          ...definirConclusaoDoFormulario(
            status.finalizaAtividade,
            extrairConclusao(dados),
            obterMomentoLocal(agora, board.fusoHorario),
          ),
          versao: incrementarVersaoAtividade(),
        })
        .where(eq(atividades.id, atual.id))
        .run();
      sincronizarTagsDaAtividade(transacao, board.id, atual.id, dados.tags);
      vincularArquivosDaAtividade(
        transacao,
        atual.id,
        dados.descricao,
        preparados,
        origem,
        agora,
      );
      registrarAlteracoesAtividade(
        transacao,
        atual.id,
        'edicao',
        antes,
        origem,
        agora,
      );
      return { atividadeId: atual.id, versao: atual.versao + 1 };
    }, TRANSACAO_ESCRITA),
  );
}

// A versão só avança quando o status muda: reordenar dentro da coluna não
// altera nenhum campo editável, e a ordem já é protegida pela conferência da
// coluna de destino.
function executarMovimento(
  transacao: ExecutorBanco,
  movimento: MovimentoAtividade,
  agora: Date,
  origem: OrigemAlteracao,
): AtividadeGravada {
  const board = exigirBoardPadrao(transacao);
  const atual = exigirAtividadeAtiva(
    transacao,
    board.id,
    movimento.atividadeId,
  );
  exigirVersaoEsperada(
    atual.versao,
    movimento.versaoEsperada,
    mensagens.atividadeAlterada,
  );
  const destino = exigirStatusDoBoard(
    transacao,
    board.id,
    movimento.statusDestinoId,
  );
  const ordemGravada = listarIdsAtivosDoStatus(transacao, destino.id);
  exigirOrdemEsperada(
    removerItem(ordemGravada, atual.id),
    removerItem(movimento.ordemDestino, atual.id),
    mensagens.colunaAlterada,
  );
  const mudouStatus = destino.id !== atual.statusId;
  if (!mudouStatus && listasIguais(ordemGravada, movimento.ordemDestino)) {
    return { atividadeId: atual.id, versao: atual.versao };
  }
  if (!mudouStatus) {
    gravarOrdemDoStatus(transacao, destino.id, movimento.ordemDestino);
    return { atividadeId: atual.id, versao: atual.versao };
  }
  const antes = capturarEstadoHistorico(transacao, atual.id);
  gravarOrdemDoStatus(transacao, destino.id, movimento.ordemDestino);
  transacao
    .update(atividades)
    .set({
      ...definirConclusaoDoMovimento(
        destino.finalizaAtividade,
        mudouStatus,
        extrairConclusao(atual),
        obterMomentoLocal(agora, board.fusoHorario),
      ),
      versao: incrementarVersaoAtividade(),
    })
    .where(eq(atividades.id, atual.id))
    .run();
  registrarAlteracoesAtividade(
    transacao,
    atual.id,
    'movimento',
    antes,
    origem,
    agora,
  );
  return { atividadeId: atual.id, versao: atual.versao + 1 };
}

export function moverAtividade(
  banco: BancoDados,
  movimento: MovimentoAtividade,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
): AtividadeGravada {
  return banco.transaction(
    (transacao) => executarMovimento(transacao, movimento, agora, origem),
    TRANSACAO_ESCRITA,
  );
}

// Para clientes que não guardam a coluna inteira (API): a ordem de destino é
// montada na mesma transação a partir da ordem gravada, então não há visão
// desatualizada para conferir. Posição além do fim leva ao fim da coluna.
export function moverAtividadeParaPosicao(
  banco: BancoDados,
  movimento: MovimentoPorPosicao,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
): AtividadeGravada {
  return banco.transaction((transacao) => {
    const restantes = removerItem(
      listarIdsAtivosDoStatus(transacao, movimento.statusDestinoId),
      movimento.atividadeId,
    );
    return executarMovimento(
      transacao,
      {
        atividadeId: movimento.atividadeId,
        versaoEsperada: movimento.versaoEsperada,
        statusDestinoId: movimento.statusDestinoId,
        ordemDestino: moverParaPosicao(
          restantes,
          movimento.atividadeId,
          movimento.posicao ?? restantes.length,
        ),
      },
      agora,
      origem,
    );
  }, TRANSACAO_ESCRITA);
}

// A ordem antiga fica gravada, mas deixa de contar: o índice único de ordem
// só considera atividades não arquivadas.
export function arquivarAtividade(
  banco: BancoDados,
  alteracao: AlteracaoArquivamento,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
): AtividadeGravada {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = exigirAtividadeAtiva(
      transacao,
      board.id,
      alteracao.atividadeId,
    );
    exigirVersaoEsperada(
      atual.versao,
      alteracao.versaoEsperada,
      mensagens.atividadeAlterada,
    );
    transacao
      .update(atividades)
      .set({
        arquivadaEm: agora.toISOString(),
        versao: incrementarVersaoAtividade(),
      })
      .where(eq(atividades.id, atual.id))
      .run();
    registrarEventoHistorico(transacao, {
      atividadeId: atual.id,
      tipo: 'arquivamento',
      origem,
      agora,
    });
    return { atividadeId: atual.id, versao: atual.versao + 1 };
  }, TRANSACAO_ESCRITA);
}

// A `ordem` antiga pode ter sido ocupada enquanto a atividade esteve
// arquivada; por isso ela recebe o fim do status (a posição exibida continua
// sendo a automática).
export function desarquivarAtividade(
  banco: BancoDados,
  alteracao: AlteracaoArquivamento,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
): AtividadeGravada {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = exigirAtividade(transacao, board.id, alteracao.atividadeId);
    if (atual.arquivadaEm === null) {
      throw new ErroApp(mensagens.atividadeNaoArquivada, {
        status: STATUS_ERRO.CONFLITO,
        codigo: CODIGO_ATIVIDADE_NAO_ARQUIVADA,
      });
    }
    exigirVersaoEsperada(
      atual.versao,
      alteracao.versaoEsperada,
      mensagens.atividadeAlterada,
    );
    transacao
      .update(atividades)
      .set({
        arquivadaEm: null,
        ordem: calcularProximaOrdem(transacao, atual.statusId),
        versao: incrementarVersaoAtividade(),
      })
      .where(eq(atividades.id, atual.id))
      .run();
    registrarEventoHistorico(transacao, {
      atividadeId: atual.id,
      tipo: 'restauracao',
      origem,
      agora,
    });
    return { atividadeId: atual.id, versao: atual.versao + 1 };
  }, TRANSACAO_ESCRITA);
}

export const CODIGO_LIMITE_TAGS = 'limite-de-tags';

function marcarAtividadeAlterada(
  transacao: ExecutorBanco,
  atual: { id: number; versao: number },
): AtividadeGravada {
  transacao
    .update(atividades)
    .set({ versao: incrementarVersaoAtividade() })
    .where(eq(atividades.id, atual.id))
    .run();
  return { atividadeId: atual.id, versao: atual.versao + 1 };
}

// Vínculo rápido pelo cartão: é idempotente, então dispensa a versão
// esperada; quando muda algo, a versão avança para que um formulário de
// edição aberto antes não sobrescreva a tag sem perceber. A tag equivalente
// (mesma chave normalizada) é reaproveitada pelo cadastro único.
export function vincularTagAtividade(
  banco: BancoDados,
  vinculo: VinculoTag,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
): AtividadeGravada {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = exigirAtividadeAtiva(
      transacao,
      board.id,
      vinculo.atividadeId,
    );
    const tag = garantirTag(transacao, board.id, vinculo.nome);
    const vinculadas = listarIdsTagsDaAtividade(transacao, atual.id);
    if (vinculadas.includes(tag.id)) {
      return { atividadeId: atual.id, versao: atual.versao };
    }
    if (vinculadas.length >= LIMITES_COLECAO.TAGS_POR_ATIVIDADE) {
      throw new ErroApp(mensagens.tagsDemais, {
        status: STATUS_ERRO.CONFLITO,
        codigo: CODIGO_LIMITE_TAGS,
      });
    }
    const antes = capturarEstadoHistorico(transacao, atual.id);
    transacao
      .insert(atividadesTags)
      .values({ atividadeId: atual.id, tagId: tag.id })
      .run();
    registrarAlteracoesAtividade(
      transacao,
      atual.id,
      'tags',
      antes,
      origem,
      agora,
    );
    return marcarAtividadeAlterada(transacao, atual);
  }, TRANSACAO_ESCRITA);
}

export function desvincularTagAtividade(
  banco: BancoDados,
  desvinculo: DesvinculoTag,
  agora: Date = new Date(),
  origem: OrigemAlteracao = ORIGEM_SISTEMA,
): AtividadeGravada {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = exigirAtividadeAtiva(
      transacao,
      board.id,
      desvinculo.atividadeId,
    );
    const antes = capturarEstadoHistorico(transacao, atual.id);
    const removido = transacao
      .delete(atividadesTags)
      .where(
        and(
          eq(atividadesTags.atividadeId, atual.id),
          eq(atividadesTags.tagId, desvinculo.tagId),
        ),
      )
      .run();
    if (removido.changes === 0) {
      return { atividadeId: atual.id, versao: atual.versao };
    }
    registrarAlteracoesAtividade(
      transacao,
      atual.id,
      'tags',
      antes,
      origem,
      agora,
    );
    return marcarAtividadeAlterada(transacao, atual);
  }, TRANSACAO_ESCRITA);
}
