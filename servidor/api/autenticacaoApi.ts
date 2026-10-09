import type { PermissaoApi } from '@/config/constantes';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import { CODIGOS_ERRO_API, mensagensApi } from '@/servidor/api/mensagensApi';
import { ErroApiComCabecalhos } from '@/servidor/api/respostasApi';
import {
  validarTokenApi,
  type TokenApiValidado,
} from '@/servidor/tokensApi/tokensApiServico';
import { STATUS_ERRO } from '@/util/ErroApp';

const CABECALHO_BEARER = /^Bearer[ \t]+([^\s]+)[ \t]*$/i;
const DESAFIO_AUTENTICACAO = 'Bearer realm="board-atividades"';

export function extrairTokenBearer(cabecalho: string | null): string | null {
  if (!cabecalho) {
    return null;
  }
  return CABECALHO_BEARER.exec(cabecalho.trim())?.[1] ?? null;
}

// RFC 6750: 401 com desafio Bearer quando falta ou não vale o token; 403
// (insufficient_scope) quando o token vale mas não tem a permissão. Token
// inexistente, expirado e revogado recebem a mesma resposta.
export function autenticarRequisicaoApi(
  executor: ExecutorBanco,
  cabecalhoAutorizacao: string | null,
  permissoesExigidas: readonly PermissaoApi[],
  agora: Date = new Date(),
): TokenApiValidado {
  const token = extrairTokenBearer(cabecalhoAutorizacao);
  if (!token) {
    throw new ErroApiComCabecalhos(mensagensApi.tokenAusente, {
      status: STATUS_ERRO.NAO_AUTORIZADO,
      codigo: CODIGOS_ERRO_API.TOKEN_AUSENTE,
      cabecalhos: { 'WWW-Authenticate': DESAFIO_AUTENTICACAO },
    });
  }
  const validado = validarTokenApi(executor, token, agora);
  if (!validado) {
    throw new ErroApiComCabecalhos(mensagensApi.tokenInvalido, {
      status: STATUS_ERRO.NAO_AUTORIZADO,
      codigo: CODIGOS_ERRO_API.TOKEN_INVALIDO,
      cabecalhos: {
        'WWW-Authenticate': `${DESAFIO_AUTENTICACAO}, error="invalid_token"`,
      },
    });
  }
  const faltantes = permissoesExigidas.filter(
    (permissao) => !validado.permissoes.includes(permissao),
  );
  if (faltantes.length > 0) {
    throw new ErroApiComCabecalhos(
      mensagensApi.permissaoInsuficiente(faltantes),
      {
        status: STATUS_ERRO.PROIBIDO,
        codigo: CODIGOS_ERRO_API.PERMISSAO_INSUFICIENTE,
        cabecalhos: {
          'WWW-Authenticate': `${DESAFIO_AUTENTICACAO}, error="insufficient_scope", scope="${faltantes.join(' ')}"`,
        },
      },
    );
  }
  return validado;
}
