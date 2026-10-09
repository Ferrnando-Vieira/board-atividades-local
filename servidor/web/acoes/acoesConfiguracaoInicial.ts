'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  PARAMETRO_CONFIGURACAO_CONCLUIDA,
  ROTAS,
  VALOR_CONFIGURACAO_CONCLUIDA,
} from '@/config/rotas';
import { concluirConfiguracaoInicial } from '@/servidor/administracao/configuracaoInicial';
import { esquemaConfiguracaoInicial } from '@/servidor/administracao/esquemasAdministracao';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type { EstadoFormulario } from '@/types/formulario';
import { ehErroApp } from '@/util/ErroApp';

export async function concluirConfiguracao(
  _estadoAnterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const validacao = esquemaConfiguracaoInicial.safeParse({
    codigo: dados.get('codigo'),
    usuario: dados.get('usuario'),
    senha: dados.get('senha'),
    confirmacaoSenha: dados.get('confirmacaoSenha'),
    solicitantePadrao: dados.get('solicitantePadrao'),
  });
  if (!validacao.success) {
    return { errosCampos: z.flattenError(validacao.error).fieldErrors };
  }
  try {
    await concluirConfiguracaoInicial(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    if (ehErroApp(erro)) {
      return { mensagemErro: erro.message };
    }
    throw erro;
  }
  redirect(
    `${ROTAS.ENTRAR}?${PARAMETRO_CONFIGURACAO_CONCLUIDA}=${VALOR_CONFIGURACAO_CONCLUIDA}`,
  );
}
