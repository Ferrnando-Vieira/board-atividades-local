import 'server-only';
import type { z } from 'zod';
import type { PermissaoApi } from '@/config/constantes';
import { lerIdentificadorRota } from '@/config/rotas';
import { verificarEstadoInstalacao } from '@/servidor/administracao/estadoInstalacao';
import { autenticarRequisicaoApi } from '@/servidor/api/autenticacaoApi';
import {
  METODOS_API,
  type EndpointApi,
  type MetodoApi,
} from '@/servidor/api/catalogoApi';
import { CODIGOS_ERRO_API, mensagensApi } from '@/servidor/api/mensagensApi';
import {
  converterErroEmResposta,
  ErroApiComCabecalhos,
  responderDados,
} from '@/servidor/api/respostasApi';
import type { BancoDados } from '@/servidor/banco/conexao';
import {
  criarOrigemAlteracao,
  type OrigemAlteracao,
} from '@/servidor/historico/origemAlteracao';
import { publicarAlteracaoBoard } from '@/servidor/tempoReal/alteracoesBoard';
import type { TokenApiValidado } from '@/servidor/tokensApi/tokensApiServico';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const STATUS_SUCESSO = 200;
const METODOS_LEITURA = new Set(['GET', 'HEAD', 'OPTIONS']);

export type ParametrosRotaApi = Record<string, string | string[] | undefined>;

export type ContextoRotaApi = {
  params: Promise<ParametrosRotaApi>;
};

export type ManipuladorApi = (
  requisicao: Request,
  contexto: ContextoRotaApi,
) => Promise<Response>;

export type ExecucaoApi = {
  banco: BancoDados;
  requisicao: Request;
  parametros: ParametrosRotaApi;
  token: TokenApiValidado;
  agora: Date;
};

export type RespostaApi = {
  status: number;
  dados: unknown;
  cabecalhos: Record<string, string>;
};

type ExecutorRotaApi = (
  execucao: ExecucaoApi,
) => RespostaApi | Response | Promise<RespostaApi | Response>;

type OpcoesResposta = {
  status?: number;
  cabecalhos?: Record<string, string>;
};

// A resposta passa pelo esquema de saída antes de sair: campo fora do
// contrato (um hash, por exemplo) é descartado, e formato errado vira 500.
export function respostaApi<E extends z.ZodType>(
  esquema: E,
  dados: z.input<E>,
  opcoes: OpcoesResposta = {},
): RespostaApi {
  return {
    status: opcoes.status ?? STATUS_SUCESSO,
    dados: esquema.parse(dados),
    cabecalhos: opcoes.cabecalhos ?? {},
  };
}

// Autor gravado no histórico das alterações feitas pela API (e pelo MCP, que
// usa a API): o nome do token.
export function montarOrigemApi(execucao: ExecucaoApi): OrigemAlteracao {
  return criarOrigemAlteracao('api', execucao.token.nome);
}

export function lerIdentificadorApi(
  parametros: ParametrosRotaApi,
  nome = 'id',
): number {
  const identificador = lerIdentificadorRota(parametros[nome]);
  if (identificador === null) {
    throw new ErroApp(mensagensApi.recursoInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGOS_ERRO_API.RECURSO_INEXISTENTE,
    });
  }
  return identificador;
}

function exigirInstalacaoPronta(banco: BancoDados): void {
  if (verificarEstadoInstalacao(banco) !== 'pronta') {
    throw new ErroApp(mensagensApi.instalacaoIncompleta, {
      status: STATUS_ERRO.INDISPONIVEL,
      codigo: CODIGOS_ERRO_API.INSTALACAO_INCOMPLETA,
    });
  }
}

// Ordem fixa em toda rota: instalação pronta, token válido com as
// permissões exigidas e só então a operação. Nada é lido antes disso.
function criarRotaApi(
  permissoes: readonly PermissaoApi[],
  executar: ExecutorRotaApi,
): ManipuladorApi {
  return async (requisicao, contexto) => {
    try {
      const banco = obterBancoAplicacao();
      exigirInstalacaoPronta(banco);
      const agora = new Date();
      const token = autenticarRequisicaoApi(
        banco,
        requisicao.headers.get('authorization'),
        permissoes,
        agora,
      );
      const resposta = await executar({
        banco,
        requisicao,
        parametros: await contexto.params,
        token,
        agora,
      });
      // Escrita pela API (e pelo MCP, que usa a API) chega às abas abertas
      // como chegaria uma alteração feita na própria tela.
      if (!METODOS_LEITURA.has(requisicao.method)) {
        publicarAlteracaoBoard();
      }
      return resposta instanceof Response
        ? resposta
        : responderDados(resposta.dados, resposta.status, resposta.cabecalhos);
    } catch (erro) {
      return converterErroEmResposta(erro);
    }
  };
}

export function criarRotaDoEndpoint(
  endpoint: EndpointApi,
  executar: ExecutorRotaApi,
): ManipuladorApi {
  return criarRotaApi(endpoint.permissoes, executar);
}

export const rotaInexistente: ManipuladorApi = criarRotaApi([], () => {
  throw new ErroApp(mensagensApi.rotaInexistente, {
    status: STATUS_ERRO.NAO_ENCONTRADO,
    codigo: CODIGOS_ERRO_API.ROTA_INEXISTENTE,
  });
});

function criarRotaMetodoNaoPermitido(
  permitidos: readonly MetodoApi[],
): ManipuladorApi {
  return criarRotaApi([], () => {
    throw new ErroApiComCabecalhos(
      mensagensApi.metodoNaoPermitido(permitidos),
      {
        status: STATUS_ERRO.METODO_NAO_PERMITIDO,
        codigo: CODIGOS_ERRO_API.METODO_NAO_PERMITIDO,
        cabecalhos: { Allow: permitidos.join(', ') },
      },
    );
  });
}

// Todo route.ts da API exporta os cinco métodos: os não implementados
// respondem 405 em JSON (com Allow), depois de autenticar como os demais.
export function montarMetodosApi(
  implementados: Partial<Record<MetodoApi, ManipuladorApi>>,
): Record<MetodoApi, ManipuladorApi> {
  const naoPermitido = criarRotaMetodoNaoPermitido(
    METODOS_API.filter((metodo) => implementados[metodo] !== undefined),
  );
  return {
    GET: implementados.GET ?? naoPermitido,
    POST: implementados.POST ?? naoPermitido,
    PUT: implementados.PUT ?? naoPermitido,
    PATCH: implementados.PATCH ?? naoPermitido,
    DELETE: implementados.DELETE ?? naoPermitido,
  };
}
