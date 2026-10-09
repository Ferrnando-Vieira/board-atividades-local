'use server';

import { redirect } from 'next/navigation';
import { ROTAS } from '@/config/rotas';
import {
  autenticarAdministrador,
  type MotivoFalhaAutenticacao,
} from '@/servidor/administracao/autenticacao';
import { esquemaEntrada } from '@/servidor/administracao/esquemasAdministracao';
import { mensagensAdministracao } from '@/servidor/administracao/mensagensAdministracao';
import { revogarSessao } from '@/servidor/administracao/sessoes';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  gravarCookieSessao,
  lerTokenSessao,
  removerCookieSessao,
} from '@/servidor/web/cookieSessao';
import type { EstadoFormulario } from '@/types/formulario';

const MENSAGEM_POR_MOTIVO: Record<MotivoFalhaAutenticacao, string> = {
  'configuracao-pendente': mensagensAdministracao.configuracaoPendente,
  bloqueado: mensagensAdministracao.acessoBloqueado,
  'credenciais-invalidas': mensagensAdministracao.credenciaisInvalidas,
};

export async function entrar(
  _estadoAnterior: EstadoFormulario,
  dados: FormData,
): Promise<EstadoFormulario> {
  const validacao = esquemaEntrada.safeParse({
    usuario: dados.get('usuario'),
    senha: dados.get('senha'),
  });
  if (!validacao.success) {
    return { mensagemErro: mensagensAdministracao.credenciaisInvalidas };
  }
  const resultado = await autenticarAdministrador(
    obterBancoAplicacao(),
    validacao.data,
  );
  if (!resultado.autenticado) {
    return { mensagemErro: MENSAGEM_POR_MOTIVO[resultado.motivo] };
  }
  await gravarCookieSessao(resultado.token, resultado.expiraEm);
  redirect(ROTAS.INICIO);
}

// Só revoga a sessão do próprio cookie; sem cookie válido, apenas limpa.
export async function sair(): Promise<void> {
  const token = await lerTokenSessao();
  if (token) {
    revogarSessao(obterBancoAplicacao(), token);
  }
  await removerCookieSessao();
  redirect(ROTAS.ENTRAR);
}
