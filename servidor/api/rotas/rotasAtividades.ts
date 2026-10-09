import { PREFIXO_API } from '@/config/rotas';
import { ENDPOINTS_API } from '@/servidor/api/catalogoApi';
import {
  lerCorpoJson,
  lerParametrosConsulta,
  validarEntradaApi,
} from '@/servidor/api/entradaApi';
import {
  esquemaAtividadeApi,
  esquemaAtualizacaoAtividadeApi,
  esquemaConsultaAtividadesApi,
  esquemaCriacaoAtividadeApi,
  esquemaListaAtividadesApi,
  esquemaMovimentoAtividadeApi,
  esquemaVersaoApi,
  type AtualizacaoAtividadeApi,
} from '@/servidor/api/esquemasApi';
import {
  criarRotaDoEndpoint,
  lerIdentificadorApi,
  montarOrigemApi,
  respostaApi,
  type ExecucaoApi,
} from '@/servidor/api/manipuladorApi';
import {
  calcularPosicoes,
  exigirAtividadeDetalhada,
  mapearAtividadeApi,
  obterAtividadeApi,
} from '@/servidor/api/mapeadoresApi';
import { exigirVersaoEsperada } from '@/servidor/banco/concorrencia';
import type { BancoDados } from '@/servidor/banco/conexao';
import {
  arquivarAtividade,
  criarAtividade,
  desarquivarAtividade,
  editarAtividade,
  moverAtividadeParaPosicao,
} from '@/servidor/atividades/atividadesServico';
import {
  listarAtividadesDetalhadas,
  type AtividadeDetalhada,
} from '@/servidor/atividades/consultasAtividades';
import {
  esquemaArquivamentoAtividade,
  esquemaEdicaoAtividade,
  esquemaMovimentoPorPosicao,
  esquemaNovaAtividade,
} from '@/servidor/atividades/esquemasAtividades';
import { criarFiltroAtividades } from '@/servidor/atividades/filtrosAtividades';
import { mensagensAtividades } from '@/servidor/atividades/mensagensAtividades';
import {
  CODIGO_STATUS_INEXISTENTE,
  exigirBoardPadrao,
  listarStatusDoBoard,
} from '@/servidor/board/boardRepositorio';
import { mensagensStatus } from '@/servidor/board/mensagensStatus';
import {
  listarIdsSolicitantesPorNomes,
  listarIdsTagsPorNomes,
} from '@/servidor/classificacao/classificacaoRepositorio';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const STATUS_CRIADO = 201;

function montarLocalizacao(atividadeId: number): Record<string, string> {
  return { Location: `${PREFIXO_API}/atividades/${atividadeId}` };
}

function exigirPrimeiroStatus(banco: BancoDados): number {
  const [primeiro] = listarStatusDoBoard(banco, exigirBoardPadrao(banco).id);
  if (!primeiro) {
    throw new ErroApp(mensagensStatus.statusInexistente, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGO_STATUS_INEXISTENTE,
    });
  }
  return primeiro.id;
}

// Grupo pedido sem nenhum nome cadastrado não pode virar "grupo vazio" (que
// não filtra): nesse caso a lista volta vazia.
export const rotaListarAtividades = criarRotaDoEndpoint(
  ENDPOINTS_API.listarAtividades,
  ({ banco, requisicao }) => {
    const consulta = validarEntradaApi(
      esquemaConsultaAtividadesApi,
      lerParametrosConsulta(requisicao, {
        listas: ['status', 'tag', 'solicitante'],
        unicos: ['busca', 'situacao'],
      }),
    );
    const board = exigirBoardPadrao(banco);
    const tagIds = listarIdsTagsPorNomes(banco, board.id, consulta.tag);
    const solicitanteIds = listarIdsSolicitantesPorNomes(
      banco,
      board.id,
      consulta.solicitante,
    );
    const semCorrespondencia =
      (consulta.tag.length > 0 && tagIds.length === 0) ||
      (consulta.solicitante.length > 0 && solicitanteIds.length === 0);
    const atividades: AtividadeDetalhada[] = semCorrespondencia
      ? []
      : listarAtividadesDetalhadas(
          banco,
          criarFiltroAtividades({
            statusIds: consulta.status,
            tagIds,
            solicitanteIds,
            arquivamento: consulta.situacao,
          }),
          consulta.busca ?? null,
        );
    const posicoes = calcularPosicoes(banco, board.id);
    return respostaApi(
      esquemaListaAtividadesApi,
      atividades.map((atividade) => mapearAtividadeApi(atividade, posicoes)),
    );
  },
);

export const rotaCriarAtividade = criarRotaDoEndpoint(
  ENDPOINTS_API.criarAtividade,
  async (execucao) => {
    const { banco, requisicao, agora } = execucao;
    const entrada = validarEntradaApi(
      esquemaCriacaoAtividadeApi,
      await lerCorpoJson(requisicao),
    );
    const dados = validarEntradaApi(esquemaNovaAtividade, {
      titulo: entrada.titulo,
      descricao: entrada.descricao ?? null,
      prioridade: entrada.prioridade ?? null,
      statusId: entrada.statusId ?? exigirPrimeiroStatus(banco),
      solicitante: entrada.solicitante ?? null,
      tags: entrada.tags ?? [],
      prazoData: entrada.prazoData ?? null,
      prazoHora: entrada.prazoHora ?? null,
      concluidaEmData: entrada.concluidaEmData ?? null,
      concluidaEmHora: entrada.concluidaEmHora ?? null,
    });
    const { atividadeId } = criarAtividade(
      banco,
      dados,
      agora,
      montarOrigemApi(execucao),
    );
    return respostaApi(
      esquemaAtividadeApi,
      obterAtividadeApi(banco, atividadeId),
      {
        status: STATUS_CRIADO,
        cabecalhos: montarLocalizacao(atividadeId),
      },
    );
  },
);

export const rotaLerAtividade = criarRotaDoEndpoint(
  ENDPOINTS_API.lerAtividade,
  ({ banco, parametros }) =>
    respostaApi(
      esquemaAtividadeApi,
      obterAtividadeApi(banco, lerIdentificadorApi(parametros)),
    ),
);

function escolher<T>(enviado: T | undefined, atual: T): T {
  return enviado === undefined ? atual : enviado;
}

// PATCH sobre o mesmo esquema e serviço do formulário: os campos omitidos
// vêm do estado gravado, e a versão é conferida de novo na transação.
function montarEdicao(
  atividadeId: number,
  entrada: AtualizacaoAtividadeApi,
  atual: AtividadeDetalhada,
) {
  return {
    atividadeId,
    versaoEsperada: entrada.versaoEsperada,
    titulo: escolher(entrada.titulo, atual.titulo),
    descricao: escolher(entrada.descricao, atual.descricao),
    prioridade: escolher(entrada.prioridade, atual.prioridade),
    statusId: escolher(entrada.statusId, atual.status.id),
    solicitante: escolher(entrada.solicitante, atual.solicitante),
    tags: escolher(
      entrada.tags,
      atual.tags.map((tag) => tag.nome),
    ),
    prazoData: escolher(entrada.prazoData, atual.prazoData),
    prazoHora: escolher(entrada.prazoHora, atual.prazoHora),
    concluidaEmData: escolher(entrada.concluidaEmData, atual.concluidaEmData),
    concluidaEmHora: escolher(entrada.concluidaEmHora, atual.concluidaEmHora),
  };
}

export const rotaAtualizarAtividade = criarRotaDoEndpoint(
  ENDPOINTS_API.atualizarAtividade,
  async (execucao) => {
    const { banco, requisicao, parametros, agora } = execucao;
    const atividadeId = lerIdentificadorApi(parametros);
    const entrada = validarEntradaApi(
      esquemaAtualizacaoAtividadeApi,
      await lerCorpoJson(requisicao),
    );
    const atual = exigirAtividadeDetalhada(banco, atividadeId);
    exigirVersaoEsperada(
      atual.versao,
      entrada.versaoEsperada,
      mensagensAtividades.atividadeAlterada,
    );
    editarAtividade(
      banco,
      validarEntradaApi(
        esquemaEdicaoAtividade,
        montarEdicao(atividadeId, entrada, atual),
      ),
      agora,
      montarOrigemApi(execucao),
    );
    return respostaApi(
      esquemaAtividadeApi,
      obterAtividadeApi(banco, atividadeId),
    );
  },
);

export const rotaMoverAtividade = criarRotaDoEndpoint(
  ENDPOINTS_API.moverAtividade,
  async (execucao) => {
    const { banco, requisicao, parametros, agora } = execucao;
    const atividadeId = lerIdentificadorApi(parametros);
    const entrada = validarEntradaApi(
      esquemaMovimentoAtividadeApi,
      await lerCorpoJson(requisicao),
    );
    const statusDestinoId =
      entrada.statusId ??
      exigirAtividadeDetalhada(banco, atividadeId).status.id;
    moverAtividadeParaPosicao(
      banco,
      validarEntradaApi(esquemaMovimentoPorPosicao, {
        atividadeId,
        versaoEsperada: entrada.versaoEsperada,
        statusDestinoId,
        posicao: entrada.posicao ?? null,
      }),
      agora,
      montarOrigemApi(execucao),
    );
    return respostaApi(
      esquemaAtividadeApi,
      obterAtividadeApi(banco, atividadeId),
    );
  },
);

async function lerArquivamento({ requisicao, parametros }: ExecucaoApi) {
  const atividadeId = lerIdentificadorApi(parametros);
  const { versaoEsperada } = validarEntradaApi(
    esquemaVersaoApi,
    await lerCorpoJson(requisicao),
  );
  return validarEntradaApi(esquemaArquivamentoAtividade, {
    atividadeId,
    versaoEsperada,
  });
}

export const rotaArquivarAtividade = criarRotaDoEndpoint(
  ENDPOINTS_API.arquivarAtividade,
  async (execucao) => {
    const alteracao = await lerArquivamento(execucao);
    arquivarAtividade(
      execucao.banco,
      alteracao,
      execucao.agora,
      montarOrigemApi(execucao),
    );
    return respostaApi(
      esquemaAtividadeApi,
      obterAtividadeApi(execucao.banco, alteracao.atividadeId),
    );
  },
);

export const rotaDesarquivarAtividade = criarRotaDoEndpoint(
  ENDPOINTS_API.desarquivarAtividade,
  async (execucao) => {
    const alteracao = await lerArquivamento(execucao);
    desarquivarAtividade(
      execucao.banco,
      alteracao,
      execucao.agora,
      montarOrigemApi(execucao),
    );
    return respostaApi(
      esquemaAtividadeApi,
      obterAtividadeApi(execucao.banco, alteracao.atividadeId),
    );
  },
);
