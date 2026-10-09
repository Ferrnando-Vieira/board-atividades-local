import { VALOR_CAMPO_MARCADO } from '@/config/constantes';
import { PREFIXO_API } from '@/config/rotas';
import { ENDPOINTS_API } from '@/servidor/api/catalogoApi';
import {
  lerCorpoJson,
  lerParametrosConsulta,
  validarEntradaApi,
} from '@/servidor/api/entradaApi';
import {
  esquemaAtualizacaoStatusApi,
  esquemaCriacaoStatusApi,
  esquemaExclusaoStatusApi,
  esquemaExclusaoStatusResultadoApi,
  esquemaListaStatusApi,
  esquemaMovimentoStatusApi,
  esquemaStatusApi,
} from '@/servidor/api/esquemasApi';
import {
  criarRotaDoEndpoint,
  lerIdentificadorApi,
  respostaApi,
} from '@/servidor/api/manipuladorApi';
import { listarStatusApi, obterStatusApi } from '@/servidor/api/mapeadoresApi';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  esquemaEdicaoStatus,
  esquemaExclusaoStatus,
  esquemaMovimentoStatusPorPosicao,
  esquemaNovoStatus,
} from '@/servidor/board/esquemasStatus';
import {
  criarStatus,
  editarStatus,
  excluirStatus,
  moverStatusParaPosicao,
} from '@/servidor/board/statusServico';

const STATUS_CRIADO = 201;

// O esquema do domínio lê a marcação como no formulário (caixa marcada).
function converterMarcacao(marcado: boolean): string {
  return marcado ? VALOR_CAMPO_MARCADO : '';
}

export const rotaListarStatus = criarRotaDoEndpoint(
  ENDPOINTS_API.listarStatus,
  ({ banco }) =>
    respostaApi(
      esquemaListaStatusApi,
      listarStatusApi(banco, exigirBoardPadrao(banco).id),
    ),
);

export const rotaCriarStatus = criarRotaDoEndpoint(
  ENDPOINTS_API.criarStatus,
  async ({ banco, requisicao }) => {
    const entrada = validarEntradaApi(
      esquemaCriacaoStatusApi,
      await lerCorpoJson(requisicao),
    );
    const { statusId } = criarStatus(
      banco,
      validarEntradaApi(esquemaNovoStatus, {
        nome: entrada.nome,
        finalizaAtividade: converterMarcacao(
          entrada.finalizaAtividade ?? false,
        ),
        corTitulo: entrada.corTitulo ?? null,
        corColuna: entrada.corColuna ?? null,
      }),
    );
    return respostaApi(
      esquemaStatusApi,
      obterStatusApi(banco, exigirBoardPadrao(banco).id, statusId),
      {
        status: STATUS_CRIADO,
        cabecalhos: { Location: `${PREFIXO_API}/status/${statusId}` },
      },
    );
  },
);

export const rotaAtualizarStatus = criarRotaDoEndpoint(
  ENDPOINTS_API.atualizarStatus,
  async ({ banco, requisicao, parametros }) => {
    const statusId = lerIdentificadorApi(parametros);
    const entrada = validarEntradaApi(
      esquemaAtualizacaoStatusApi,
      await lerCorpoJson(requisicao),
    );
    const boardId = exigirBoardPadrao(banco).id;
    const atual = obterStatusApi(banco, boardId, statusId);
    editarStatus(
      banco,
      validarEntradaApi(esquemaEdicaoStatus, {
        statusId,
        versaoEsperada: entrada.versaoEsperada,
        nome: entrada.nome ?? atual.nome,
        finalizaAtividade: converterMarcacao(
          entrada.finalizaAtividade ?? atual.finalizaAtividade,
        ),
        corTitulo:
          entrada.corTitulo === undefined ? atual.corTitulo : entrada.corTitulo,
        corColuna:
          entrada.corColuna === undefined ? atual.corColuna : entrada.corColuna,
      }),
    );
    return respostaApi(
      esquemaStatusApi,
      obterStatusApi(banco, boardId, statusId),
    );
  },
);

export const rotaMoverStatus = criarRotaDoEndpoint(
  ENDPOINTS_API.moverStatus,
  async ({ banco, requisicao, parametros }) => {
    const statusId = lerIdentificadorApi(parametros);
    const { posicao } = validarEntradaApi(
      esquemaMovimentoStatusApi,
      await lerCorpoJson(requisicao),
    );
    moverStatusParaPosicao(
      banco,
      validarEntradaApi(esquemaMovimentoStatusPorPosicao, {
        statusId,
        posicao,
      }),
    );
    return respostaApi(
      esquemaListaStatusApi,
      listarStatusApi(banco, exigirBoardPadrao(banco).id),
    );
  },
);

export const rotaExcluirStatus = criarRotaDoEndpoint(
  ENDPOINTS_API.excluirStatus,
  ({ banco, requisicao, parametros, agora }) => {
    const statusId = lerIdentificadorApi(parametros);
    const consulta = validarEntradaApi(
      esquemaExclusaoStatusApi,
      lerParametrosConsulta(requisicao, {
        unicos: ['versaoEsperada', 'statusDestinoId'],
      }),
    );
    const { atividadesMovidas } = excluirStatus(
      banco,
      validarEntradaApi(esquemaExclusaoStatus, {
        statusId,
        versaoEsperada: consulta.versaoEsperada,
        statusDestinoId: consulta.statusDestinoId ?? null,
      }),
      agora,
    );
    return respostaApi(esquemaExclusaoStatusResultadoApi, {
      statusId,
      atividadesMovidas,
    });
  },
);
