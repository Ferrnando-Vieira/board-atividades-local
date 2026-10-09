import { z } from 'zod';
import { CAMPOS_TOKEN_API } from '@/config/camposFormulario';
import { LIMITES_TEXTO, PERMISSOES_API_OFERECIDAS } from '@/config/constantes';
import { OPCOES_VALIDADE_DIAS } from '@/config/constantesSeguranca';
import { mensagensTokensApi as mensagens } from '@/servidor/tokensApi/mensagensTokensApi';
import {
  campoIdentificador,
  campoOpcaoInteiraOpcional,
} from '@/util/EsquemaUtils';
import { normalizarNomeExibicao } from '@/util/NormalizacaoUtils';

export const CAMPOS_TEXTO_NOVO_TOKEN = [
  CAMPOS_TOKEN_API.NOME,
  CAMPOS_TOKEN_API.VALIDADE,
] as const;

export const CAMPOS_LISTA_NOVO_TOKEN = [CAMPOS_TOKEN_API.PERMISSOES] as const;

const esquemaNomeToken = z.preprocess(
  (valor) =>
    typeof valor === 'string' ? normalizarNomeExibicao(valor) : valor,
  z
    .string({ error: mensagens.nomeObrigatorio })
    .min(1, { error: mensagens.nomeObrigatorio })
    .max(LIMITES_TEXTO.NOME_TOKEN_API, { error: mensagens.nomeLongo }),
);

// Só as permissões oferecidas na tela; anexos:* continuam no catálogo do
// banco, reservadas para quando a API de anexos existir.
export const esquemaNovoTokenApi = z.object({
  nome: esquemaNomeToken,
  permissoes: z.preprocess(
    (valor) => (valor === null || valor === undefined ? [] : valor),
    z
      .array(
        z.enum(PERMISSOES_API_OFERECIDAS, {
          error: mensagens.permissaoInvalida,
        }),
        { error: mensagens.dadosInvalidos },
      )
      .min(1, { error: mensagens.permissoesObrigatorias })
      .transform((permissoes) => [...new Set(permissoes)]),
  ),
  validadeDias: campoOpcaoInteiraOpcional(
    OPCOES_VALIDADE_DIAS,
    mensagens.validadeInvalida,
  ),
});

export type DadosNovoTokenApi = z.output<typeof esquemaNovoTokenApi>;

export const esquemaRevogacaoTokenApi = z.object({
  tokenId: campoIdentificador(mensagens.dadosInvalidos),
});

export type DadosRevogacaoTokenApi = z.output<typeof esquemaRevogacaoTokenApi>;
