'use server';

import { redirect } from 'next/navigation';
import { CAMPOS_TAG } from '@/config/camposFormulario';
import { adicionarAviso, aplicarPrefixo, AVISOS, ROTAS } from '@/config/rotas';
import {
  esquemaEdicaoTag,
  esquemaExclusaoTag,
  esquemaNovaTag,
} from '@/servidor/classificacao/esquemasTags';
import { mensagensTags as mensagens } from '@/servidor/classificacao/mensagensTags';
import {
  criarTag,
  editarTag,
  excluirTag,
} from '@/servidor/classificacao/tagsServico';
import {
  estadoDeFalhaNegocio,
  estadoDeFalhaValidacao,
  estadoDeSucesso,
  lerCredencialFormulario,
  revalidarPainel,
} from '@/servidor/web/acoes/suporteAcoes';
import { exigirAcessoGestao } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type { EstadoFormularioGestao } from '@/types/formulario';
import { lerValoresFormulario } from '@/util/FormularioUtils';

const CAMPOS_NOVA_TAG = [
  CAMPOS_TAG.NOME,
  CAMPOS_TAG.COR,
  CAMPOS_TAG.SOLICITANTE_PADRAO,
] as const;
const CAMPOS_EDICAO_TAG = [
  CAMPOS_TAG.TAG_ID,
  CAMPOS_TAG.NOME_ATUAL,
  CAMPOS_TAG.NOME,
  CAMPOS_TAG.COR,
  CAMPOS_TAG.SOLICITANTE_PADRAO,
] as const;
const CAMPOS_EXCLUSAO_TAG = [CAMPOS_TAG.TAG_ID, CAMPOS_TAG.NOME_ATUAL] as const;

export async function criarTagFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, CAMPOS_NOVA_TAG);
  const validacao = esquemaNovaTag.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  try {
    criarTag(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.tagCriada);
}

export async function editarTagFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, CAMPOS_EDICAO_TAG);
  const validacao = esquemaEdicaoTag.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  try {
    editarTag(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.tagAtualizada);
}

export async function excluirTagFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, CAMPOS_EXCLUSAO_TAG);
  const validacao = esquemaExclusaoTag.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    excluirTag(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  redirect(
    adicionarAviso(
      aplicarPrefixo(acesso.prefixoRotas, ROTAS.TAGS),
      AVISOS.TAG_EXCLUIDA,
    ),
  );
}
