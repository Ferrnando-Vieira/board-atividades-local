import type { z } from 'zod';
import { ehImagemExibivel } from '@/config/anexos';
import type { AnexoResumo } from '@/servidor/anexos/consultasAnexos';
import type {
  AnexoApi,
  AtividadeApi,
  esquemaLembreteApi,
  esquemaStatusApi,
} from '@/servidor/api/esquemasApi';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import {
  CODIGO_ATIVIDADE_INEXISTENTE,
  listarAtivasNaOrdemAutomatica,
  type AtividadePosicionavel,
} from '@/servidor/atividades/atividadesRepositorio';
import {
  consultarDetalheAtividade,
  type AtividadeDetalhada,
  type DetalheAtividade,
} from '@/servidor/atividades/consultasAtividades';
import { mensagensAtividades } from '@/servidor/atividades/mensagensAtividades';
import {
  CODIGO_STATUS_INEXISTENTE,
  exigirBoardPadrao,
} from '@/servidor/board/boardRepositorio';
import { listarStatusGerenciaveis } from '@/servidor/board/consultaQuadro';
import { mensagensStatus } from '@/servidor/board/mensagensStatus';
import {
  listarTagsGerenciaveis,
  type TagGerenciavel,
} from '@/servidor/classificacao/consultasClassificacao';
import { mensagensTags } from '@/servidor/classificacao/mensagensTags';
import { CODIGO_TAG_INEXISTENTE } from '@/servidor/classificacao/tagsServico';
import { mensagensLembretes } from '@/servidor/lembretes/mensagensLembretes';
import {
  CODIGO_LEMBRETE_AVULSO_INEXISTENTE,
  listarLembretesAvulsos,
  type LembreteAvulso,
} from '@/servidor/lembretes/lembretesAvulsosServico';
import { obterMomentoLocal } from '@/util/DataUtils';
import {
  montarMarcacaoImagem,
  montarReferenciaAnexo,
} from '@/util/DescricaoUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { ordenarNaColuna } from '@/util/OrdenacaoAtividadesUtils';

type StatusApi = z.input<typeof esquemaStatusApi>;
type LembreteApi = z.input<typeof esquemaLembreteApi>;

// Posição = índice entre as ativas do status na ordem do quadro (automática;
// nos status que finalizam, a conclusão mais recente primeiro). POST /atividades/{id}/mover ainda aceita `posicao` por
// compatibilidade, mas ela não altera essa ordem.
export function calcularPosicoes(
  executor: ExecutorBanco,
  boardId: number,
): Map<number, number> {
  const posicoes = new Map<number, number>();
  const porStatus = new Map<number, AtividadePosicionavel[]>();
  for (const atividade of listarAtivasNaOrdemAutomatica(executor, boardId)) {
    const lista = porStatus.get(atividade.statusId) ?? [];
    lista.push(atividade);
    porStatus.set(atividade.statusId, lista);
  }
  for (const lista of porStatus.values()) {
    ordenarNaColuna(lista, lista[0]?.finalizaAtividade ?? false).forEach(
      ({ id }, posicao) => posicoes.set(id, posicao),
    );
  }
  return posicoes;
}

export function mapearAtividadeApi(
  atividade: AtividadeDetalhada,
  posicoes: ReadonlyMap<number, number>,
): AtividadeApi {
  const arquivada = atividade.arquivadaEm !== null;
  return {
    id: atividade.id,
    titulo: atividade.titulo,
    descricao: atividade.descricao,
    prioridade: atividade.prioridade,
    versao: atividade.versao,
    status: atividade.status,
    posicao: arquivada ? null : (posicoes.get(atividade.id) ?? null),
    solicitante: atividade.solicitante,
    tags: atividade.tags,
    prazoData: atividade.prazoData,
    prazoHora: atividade.prazoHora,
    concluidaEmData: atividade.concluidaEmData,
    concluidaEmHora: atividade.concluidaEmHora,
    lembreteEm: atividade.lembreteEm,
    lembreteSituacao: atividade.lembreteSituacao,
    arquivada,
    arquivadaEm: atividade.arquivadaEm,
    criadoEm: atividade.criadoEm,
    atualizadoEm: atividade.atualizadoEm,
  };
}

export function mapearAnexoApi(anexo: AnexoResumo): AnexoApi {
  const imagem = ehImagemExibivel(anexo.tipoConteudo);
  return {
    id: anexo.id,
    nome: anexo.nomeOriginal,
    tipoConteudo: anexo.tipoConteudo,
    tamanhoBytes: anexo.tamanhoBytes,
    criadoEm: anexo.criadoEm,
    imagem,
    markdown: imagem
      ? montarMarcacaoImagem(
          anexo.nomeOriginal,
          montarReferenciaAnexo(anexo.id),
        )
      : null,
  };
}

export function exigirAtividadeDetalhada(
  executor: ExecutorBanco,
  atividadeId: number,
): DetalheAtividade {
  const consulta = consultarDetalheAtividade(executor, atividadeId);
  if (!consulta) {
    throw new ErroApp(mensagensAtividades.atividadeInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGO_ATIVIDADE_INEXISTENTE,
    });
  }
  return consulta.atividade;
}

export function obterAtividadeApi(
  executor: ExecutorBanco,
  atividadeId: number,
): AtividadeApi {
  const atividade = exigirAtividadeDetalhada(executor, atividadeId);
  return mapearAtividadeApi(
    atividade,
    calcularPosicoes(executor, exigirBoardPadrao(executor).id),
  );
}

export function listarStatusApi(
  executor: ExecutorBanco,
  boardId: number,
): StatusApi[] {
  return listarStatusGerenciaveis(executor, boardId).map((status, posicao) => ({
    ...status,
    posicao,
  }));
}

export function obterStatusApi(
  executor: ExecutorBanco,
  boardId: number,
  statusId: number,
): StatusApi {
  const status = listarStatusApi(executor, boardId).find(
    (item) => item.id === statusId,
  );
  if (!status) {
    throw new ErroApp(mensagensStatus.statusInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGO_STATUS_INEXISTENTE,
    });
  }
  return status;
}

export function obterTagApi(
  executor: ExecutorBanco,
  boardId: number,
  tagId: number,
): TagGerenciavel {
  const tag = listarTagsGerenciaveis(executor, boardId).find(
    (item) => item.id === tagId,
  );
  if (!tag) {
    throw new ErroApp(mensagensTags.tagInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGO_TAG_INEXISTENTE,
    });
  }
  return tag;
}

// `lembreteEm` é o instante em UTC (como nas atividades); data e hora vêm
// também no fuso do board, o mesmo em que são enviadas.
export function mapearLembreteApi(
  lembrete: LembreteAvulso,
  fusoHorario: string,
): LembreteApi {
  const local = obterMomentoLocal(new Date(lembrete.lembreteEm), fusoHorario);
  return {
    id: lembrete.id,
    titulo: lembrete.titulo,
    observacao: lembrete.observacao,
    lembreteEm: lembrete.lembreteEm,
    lembreteData: local.data,
    lembreteHora: local.hora,
    situacao: lembrete.situacao,
    disparadoEm: lembrete.disparadoEm,
    dispensadoEm: lembrete.dispensadoEm,
    versao: lembrete.versao,
  };
}

export function listarLembretesApi(executor: ExecutorBanco): LembreteApi[] {
  const { fusoHorario } = exigirBoardPadrao(executor);
  return listarLembretesAvulsos(executor).map((lembrete) =>
    mapearLembreteApi(lembrete, fusoHorario),
  );
}

export function obterLembreteApi(
  executor: ExecutorBanco,
  lembreteId: number,
): LembreteApi {
  const lembrete = listarLembretesApi(executor).find(
    (item) => item.id === lembreteId,
  );
  if (!lembrete) {
    throw new ErroApp(mensagensLembretes.lembreteAvulsoInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGO_LEMBRETE_AVULSO_INEXISTENTE,
    });
  }
  return lembrete;
}
