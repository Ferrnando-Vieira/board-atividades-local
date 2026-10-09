import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';
import { ROTAS } from '@/config/rotas';
import {
  validarSessao,
  type SessaoValida,
} from '@/servidor/administracao/sessoes';
import {
  verificarEstadoInstalacao,
  type EstadoInstalacao,
} from '@/servidor/administracao/estadoInstalacao';
import {
  CODIGO_BANCO_AUSENTE,
  obterBancoAplicacao,
} from '@/servidor/web/bancoAplicacao';
import { lerTokenSessao } from '@/servidor/web/cookieSessao';
import { ehErroApp } from '@/util/ErroApp';

function ehBancoInexistente(erro: unknown): boolean {
  return ehErroApp(erro) && erro.codigo === CODIGO_BANCO_AUSENTE;
}

// `connection()` força renderização por requisição: nada que leia o banco
// pode ser pré-renderizado no build, quando o banco nem precisa existir.
export const obterEstadoInstalacao = cache(
  async (): Promise<EstadoInstalacao> => {
    await connection();
    try {
      return verificarEstadoInstalacao(obterBancoAplicacao());
    } catch (erro) {
      if (ehBancoInexistente(erro)) {
        return 'banco-ausente';
      }
      throw erro;
    }
  },
);

export const obterSessaoAtual = cache(
  async (): Promise<SessaoValida | null> => {
    if ((await obterEstadoInstalacao()) !== 'pronta') {
      return null;
    }
    return validarSessao(obterBancoAplicacao(), await lerTokenSessao());
  },
);

export async function exigirSessaoAdministrativa(): Promise<SessaoValida> {
  if ((await obterEstadoInstalacao()) !== 'pronta') {
    redirect(ROTAS.CONFIGURACAO_INICIAL);
  }
  const sessao = await obterSessaoAtual();
  if (!sessao) {
    redirect(ROTAS.ENTRAR);
  }
  return sessao;
}

export async function garantirTelaEntradaDisponivel(): Promise<void> {
  if ((await obterEstadoInstalacao()) !== 'pronta') {
    redirect(ROTAS.CONFIGURACAO_INICIAL);
  }
  if (await obterSessaoAtual()) {
    redirect(ROTAS.INICIO);
  }
}

// Depois de configurada, a tela de configuração inicial deixa de existir.
export async function obterEstadoAntesDaConfiguracao(): Promise<
  Exclude<EstadoInstalacao, 'pronta'>
> {
  const estado = await obterEstadoInstalacao();
  if (estado === 'pronta') {
    redirect(ROTAS.ENTRAR);
  }
  return estado;
}
