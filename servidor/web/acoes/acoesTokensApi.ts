'use server';

import { CAMPOS_TOKEN_API } from '@/config/camposFormulario';
import {
  CAMPOS_LISTA_NOVO_TOKEN,
  CAMPOS_TEXTO_NOVO_TOKEN,
  esquemaNovoTokenApi,
  esquemaRevogacaoTokenApi,
} from '@/servidor/tokensApi/esquemasTokensApi';
import { mensagensTokensApi as mensagens } from '@/servidor/tokensApi/mensagensTokensApi';
import {
  criarTokenApi,
  revogarTokenApi,
  type TokenApiCriado,
} from '@/servidor/tokensApi/tokensApiServico';
import { exigirSessaoAdministrativa } from '@/servidor/web/acessoAdministrativo';
import {
  estadoDeFalhaNegocio,
  estadoDeFalhaValidacao,
  estadoDeSucesso,
  revalidarPainel,
} from '@/servidor/web/acoes/suporteAcoes';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type {
  EstadoCriacaoCredencial,
  EstadoFormularioGestao,
} from '@/types/formulario';
import { lerValoresFormulario } from '@/util/FormularioUtils';

const CAMPOS_REVOGACAO_TOKEN = [CAMPOS_TOKEN_API.TOKEN_ID] as const;

// Só o proprietário (sessão administrativa) emite, lista e revoga tokens; um
// token de API ou um link de compartilhamento não chegam a estas ações.
export async function criarTokenApiFormulario(
  estado: EstadoCriacaoCredencial,
  dados: FormData,
): Promise<EstadoCriacaoCredencial> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(
    dados,
    CAMPOS_TEXTO_NOVO_TOKEN,
    CAMPOS_LISTA_NOVO_TOKEN,
  );
  const validacao = esquemaNovoTokenApi.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  let criado: TokenApiCriado;
  try {
    criado = criarTokenApi(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return {
    ...estadoDeSucesso(estado, mensagens.tokenCriado),
    credencialGerada: criado.token,
  };
}

export async function revogarTokenApiFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_REVOGACAO_TOKEN);
  const validacao = esquemaRevogacaoTokenApi.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    revogarTokenApi(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.tokenRevogado);
}
