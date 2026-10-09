import { and, desc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import { PERMISSOES_API, type PermissaoApi } from '@/config/constantes';
import {
  TAMANHO_TOKEN_ALEATORIO,
  TOKEN_API,
} from '@/config/constantesSeguranca';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { tokensApi, tokensApiPermissoes } from '@/servidor/banco/esquema';
import {
  calcularHashToken,
  determinarSituacaoCredencial,
  gerarTokenSeguro,
  type SituacaoCredencial,
} from '@/servidor/seguranca/tokens';
import type {
  DadosNovoTokenApi,
  DadosRevogacaoTokenApi,
} from '@/servidor/tokensApi/esquemasTokensApi';
import { mensagensTokensApi as mensagens } from '@/servidor/tokensApi/mensagensTokensApi';
import { calcularExpiracaoEmDias, somarMinutos } from '@/util/DataUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

const FORMATO_TOKEN_API = new RegExp(
  `^${TOKEN_API.PREFIXO}[A-Za-z0-9_-]{${TAMANHO_TOKEN_ALEATORIO}}$`,
);

export const CODIGO_TOKEN_API_INEXISTENTE = 'token-api-inexistente';

export type TokenApiCriado = {
  tokenId: number;
  token: string;
  prefixo: string;
  expiraEm: string | null;
};

export type TokenApiResumo = {
  id: number;
  nome: string;
  prefixo: string;
  permissoes: PermissaoApi[];
  criadoEm: string;
  expiraEm: string | null;
  ultimoUsoEm: string | null;
  revogadoEm: string | null;
  situacao: SituacaoCredencial;
};

export type TokenApiValidado = {
  tokenId: number;
  nome: string;
  prefixo: string;
  permissoes: PermissaoApi[];
};

export function ehFormatoTokenApi(token: unknown): token is string {
  return typeof token === 'string' && FORMATO_TOKEN_API.test(token);
}

// Ordem fixa do catálogo, para a listagem e as respostas não dependerem da
// ordem em que as permissões foram marcadas.
function ordenarPermissoes(
  permissoes: readonly PermissaoApi[],
): PermissaoApi[] {
  return PERMISSOES_API.filter((permissao) => permissoes.includes(permissao));
}

export function criarTokenApi(
  banco: BancoDados,
  dados: DadosNovoTokenApi,
  agora: Date = new Date(),
): TokenApiCriado {
  const aleatorio = gerarTokenSeguro();
  const token = `${TOKEN_API.PREFIXO}${aleatorio}`;
  const prefixo = `${TOKEN_API.PREFIXO}${aleatorio.slice(0, TOKEN_API.CARACTERES_VISIVEIS)}`;
  const expiraEm = calcularExpiracaoEmDias(agora, dados.validadeDias);
  return banco.transaction((transacao) => {
    const criado = transacao
      .insert(tokensApi)
      .values({
        nome: dados.nome,
        prefixo,
        hashToken: calcularHashToken(token),
        expiraEm,
        criadoEm: agora.toISOString(),
      })
      .returning({ id: tokensApi.id })
      .get();
    transacao
      .insert(tokensApiPermissoes)
      .values(
        dados.permissoes.map((permissao) => ({
          tokenId: criado.id,
          permissao,
        })),
      )
      .run();
    return { tokenId: criado.id, token, prefixo, expiraEm };
  }, TRANSACAO_ESCRITA);
}

function agruparPermissoes(
  executor: ExecutorBanco,
  tokenIds: number[],
): Map<number, PermissaoApi[]> {
  const grupos = new Map<number, PermissaoApi[]>();
  if (tokenIds.length === 0) {
    return grupos;
  }
  const linhas = executor
    .select({
      tokenId: tokensApiPermissoes.tokenId,
      permissao: tokensApiPermissoes.permissao,
    })
    .from(tokensApiPermissoes)
    .where(inArray(tokensApiPermissoes.tokenId, tokenIds))
    .all();
  for (const { tokenId, permissao } of linhas) {
    grupos.set(tokenId, [...(grupos.get(tokenId) ?? []), permissao]);
  }
  return grupos;
}

export function listarTokensApi(
  executor: ExecutorBanco,
  agora: Date = new Date(),
): TokenApiResumo[] {
  const tokens = executor
    .select({
      id: tokensApi.id,
      nome: tokensApi.nome,
      prefixo: tokensApi.prefixo,
      criadoEm: tokensApi.criadoEm,
      expiraEm: tokensApi.expiraEm,
      ultimoUsoEm: tokensApi.ultimoUsoEm,
      revogadoEm: tokensApi.revogadoEm,
    })
    .from(tokensApi)
    .orderBy(desc(tokensApi.criadoEm), desc(tokensApi.id))
    .all();
  const permissoesPorToken = agruparPermissoes(
    executor,
    tokens.map((token) => token.id),
  );
  return tokens.map((token) => ({
    ...token,
    permissoes: ordenarPermissoes(permissoesPorToken.get(token.id) ?? []),
    situacao: determinarSituacaoCredencial(
      token.revogadoEm,
      token.expiraEm,
      agora,
    ),
  }));
}

export function revogarTokenApi(
  banco: BancoDados,
  dados: DadosRevogacaoTokenApi,
  agora: Date = new Date(),
): void {
  banco.transaction((transacao) => {
    const token = transacao
      .select({ id: tokensApi.id, revogadoEm: tokensApi.revogadoEm })
      .from(tokensApi)
      .where(eq(tokensApi.id, dados.tokenId))
      .get();
    if (!token) {
      throw new ErroApp(mensagens.tokenInexistente, {
        status: STATUS_ERRO.NAO_ENCONTRADO,
        codigo: CODIGO_TOKEN_API_INEXISTENTE,
      });
    }
    if (token.revogadoEm === null) {
      transacao
        .update(tokensApi)
        .set({ revogadoEm: agora.toISOString() })
        .where(eq(tokensApi.id, token.id))
        .run();
    }
  }, TRANSACAO_ESCRITA);
}

function registrarUsoSeNecessario(
  executor: ExecutorBanco,
  tokenId: number,
  agora: Date,
): void {
  const limiteSemRegistro = somarMinutos(
    agora,
    -TOKEN_API.INTERVALO_REGISTRO_USO_MINUTOS,
  ).toISOString();
  executor
    .update(tokensApi)
    .set({ ultimoUsoEm: agora.toISOString() })
    .where(
      and(
        eq(tokensApi.id, tokenId),
        or(
          isNull(tokensApi.ultimoUsoEm),
          lte(tokensApi.ultimoUsoEm, limiteSemRegistro),
        ),
      ),
    )
    .run();
}

// Conferido a cada requisição da API, sem cache: revogar ou expirar vale na
// requisição seguinte. Token de link de compartilhamento nunca passa aqui,
// porque não tem o prefixo nem está nesta tabela.
export function validarTokenApi(
  executor: ExecutorBanco,
  token: unknown,
  agora: Date = new Date(),
): TokenApiValidado | null {
  if (!ehFormatoTokenApi(token)) {
    return null;
  }
  const registro = executor
    .select({
      id: tokensApi.id,
      nome: tokensApi.nome,
      prefixo: tokensApi.prefixo,
    })
    .from(tokensApi)
    .where(
      and(
        eq(tokensApi.hashToken, calcularHashToken(token)),
        isNull(tokensApi.revogadoEm),
        or(
          isNull(tokensApi.expiraEm),
          gt(tokensApi.expiraEm, agora.toISOString()),
        ),
      ),
    )
    .get();
  if (!registro) {
    return null;
  }
  registrarUsoSeNecessario(executor, registro.id, agora);
  return {
    tokenId: registro.id,
    nome: registro.nome,
    prefixo: registro.prefixo,
    permissoes: ordenarPermissoes(
      agruparPermissoes(executor, [registro.id]).get(registro.id) ?? [],
    ),
  };
}
