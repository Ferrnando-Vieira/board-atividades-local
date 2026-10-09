import { PREFIXO_API } from '@/config/rotas';
import { ENDPOINTS_API } from '@/servidor/api/catalogoApi';
import {
  lerCorpoJson,
  lerParametrosConsulta,
  validarEntradaApi,
} from '@/servidor/api/entradaApi';
import {
  esquemaCriacaoTagApi,
  esquemaEdicaoTagApi,
  esquemaExclusaoTagApi,
  esquemaExclusaoTagResultadoApi,
  esquemaListaSolicitantesApi,
  esquemaListaTagsApi,
  esquemaNomeApi,
  esquemaSolicitanteRegistradoApi,
  esquemaTagApi,
} from '@/servidor/api/esquemasApi';
import {
  criarRotaDoEndpoint,
  lerIdentificadorApi,
  respostaApi,
} from '@/servidor/api/manipuladorApi';
import { obterTagApi } from '@/servidor/api/mapeadoresApi';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  listarSolicitantesGerenciaveis,
  listarTagsGerenciaveis,
} from '@/servidor/classificacao/consultasClassificacao';
import { esquemaNovoSolicitante } from '@/servidor/classificacao/esquemasSolicitantes';
import {
  esquemaEdicaoTag,
  esquemaExclusaoTag,
  esquemaNovaTag,
} from '@/servidor/classificacao/esquemasTags';
import { registrarSolicitante } from '@/servidor/classificacao/solicitantesServico';
import {
  criarTag,
  editarTag,
  excluirTag,
} from '@/servidor/classificacao/tagsServico';

const STATUS_CRIADO = 201;
const STATUS_EXISTENTE = 200;

export const rotaListarTags = criarRotaDoEndpoint(
  ENDPOINTS_API.listarTags,
  ({ banco }) =>
    respostaApi(
      esquemaListaTagsApi,
      listarTagsGerenciaveis(banco, exigirBoardPadrao(banco).id),
    ),
);

export const rotaCriarTag = criarRotaDoEndpoint(
  ENDPOINTS_API.criarTag,
  async ({ banco, requisicao }) => {
    const entrada = validarEntradaApi(
      esquemaCriacaoTagApi,
      await lerCorpoJson(requisicao),
    );
    const { tagId } = criarTag(
      banco,
      validarEntradaApi(esquemaNovaTag, entrada),
    );
    return respostaApi(
      esquemaTagApi,
      obterTagApi(banco, exigirBoardPadrao(banco).id, tagId),
      {
        status: STATUS_CRIADO,
        cabecalhos: { Location: `${PREFIXO_API}/tags/${tagId}` },
      },
    );
  },
);

export const rotaEditarTag = criarRotaDoEndpoint(
  ENDPOINTS_API.editarTag,
  async ({ banco, requisicao, parametros }) => {
    const tagId = lerIdentificadorApi(parametros);
    const entrada = validarEntradaApi(
      esquemaEdicaoTagApi,
      await lerCorpoJson(requisicao),
    );
    editarTag(
      banco,
      validarEntradaApi(esquemaEdicaoTag, {
        tagId,
        nomeAtual: entrada.nomeAtual,
        nome: entrada.nome ?? entrada.nomeAtual,
        cor: entrada.cor,
        solicitantePadrao: entrada.solicitantePadrao,
      }),
    );
    return respostaApi(
      esquemaTagApi,
      obterTagApi(banco, exigirBoardPadrao(banco).id, tagId),
    );
  },
);

export const rotaExcluirTag = criarRotaDoEndpoint(
  ENDPOINTS_API.excluirTag,
  ({ banco, requisicao, parametros }) => {
    const tagId = lerIdentificadorApi(parametros);
    const consulta = validarEntradaApi(
      esquemaExclusaoTagApi,
      lerParametrosConsulta(requisicao, { unicos: ['nomeAtual'] }),
    );
    const { atividadesAfetadas } = excluirTag(
      banco,
      validarEntradaApi(esquemaExclusaoTag, {
        tagId,
        nomeAtual: consulta.nomeAtual,
      }),
    );
    return respostaApi(esquemaExclusaoTagResultadoApi, {
      tagId,
      atividadesAfetadas,
    });
  },
);

export const rotaListarSolicitantes = criarRotaDoEndpoint(
  ENDPOINTS_API.listarSolicitantes,
  ({ banco }) =>
    respostaApi(
      esquemaListaSolicitantesApi,
      listarSolicitantesGerenciaveis(banco, exigirBoardPadrao(banco).id),
    ),
);

// Repetir o mesmo nome (sem diferença de acento ou caixa) devolve o
// cadastro existente com 200, em vez de duplicar.
export const rotaRegistrarSolicitante = criarRotaDoEndpoint(
  ENDPOINTS_API.registrarSolicitante,
  async ({ banco, requisicao }) => {
    const entrada = validarEntradaApi(
      esquemaNomeApi,
      await lerCorpoJson(requisicao),
    );
    const registro = registrarSolicitante(
      banco,
      validarEntradaApi(esquemaNovoSolicitante, entrada),
    );
    return respostaApi(esquemaSolicitanteRegistradoApi, registro, {
      status: registro.criado ? STATUS_CRIADO : STATUS_EXISTENTE,
    });
  },
);
