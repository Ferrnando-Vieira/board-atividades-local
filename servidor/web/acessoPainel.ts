import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import type { ChaveAnimal } from '@/config/animais';
import type { ModalidadeCompartilhamento } from '@/config/constantes';
import {
  aplicarPrefixo,
  montarPrefixoCompartilhamento,
  ROTAS,
} from '@/config/rotas';
import type { RestricaoLeitura } from '@/servidor/atividades/filtrosAtividades';
import {
  ESCOPO_BOARD,
  escopoDoLink,
  type EscopoAparencia,
} from '@/servidor/board/escopoAparencia';
import {
  ehFormatoTokenCompartilhamento,
  validarTokenCompartilhamento,
  type LinkValidado,
} from '@/servidor/compartilhamento/acessoCompartilhamento';
import {
  criarOrigemAlteracao,
  type OrigemAlteracao,
} from '@/servidor/historico/origemAlteracao';
import {
  exigirSessaoAdministrativa,
  obterEstadoInstalacao,
} from '@/servidor/web/acessoAdministrativo';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type { ContextoNavegacao } from '@/types/acesso';

export type TipoAcesso = 'administrador' | 'compartilhamento';

// `permiteGestao` libera as telas e ações de atividades, status e tags;
// `permiteAdministracao` (só o administrador) libera links, tokens de API e
// a própria sessão. `restricao` é aplicada em toda leitura do acesso.
export type AcessoPainel = {
  tipo: TipoAcesso;
  identificacao: string;
  modalidade: ModalidadeCompartilhamento | null;
  prefixoRotas: string;
  tokenCompartilhamento: string | null;
  restricao: RestricaoLeitura;
  permiteGestao: boolean;
  permiteAdministracao: boolean;
  exibeArquivadas: boolean;
  // Como quem entra pelo link aparece na presença: link nomeado mostra o
  // nome do link; o padrão (null) fica anônimo. Animal null = sorteado.
  nomePresenca: string | null;
  animalPresenca: ChaveAnimal | null;
  // Aparência exibida e, com `permiteAparencia`, alterável por este acesso:
  // o proprietário altera a do board; um link nomeado, só a própria; o link
  // padrão (público) só exibe a do board.
  escopoAparencia: EscopoAparencia;
  permiteAparencia: boolean;
};

export function criarAcessoAdministrativo(usuario: string): AcessoPainel {
  return {
    tipo: 'administrador',
    identificacao: usuario,
    modalidade: null,
    prefixoRotas: '',
    tokenCompartilhamento: null,
    restricao: null,
    permiteGestao: true,
    permiteAdministracao: true,
    exibeArquivadas: true,
    nomePresenca: null,
    animalPresenca: null,
    escopoAparencia: ESCOPO_BOARD,
    permiteAparencia: true,
  };
}

export function criarAcessoCompartilhado(
  token: string,
  link: LinkValidado,
): AcessoPainel {
  return {
    tipo: 'compartilhamento',
    identificacao: link.nome,
    modalidade: link.modalidade,
    prefixoRotas: montarPrefixoCompartilhamento(token),
    tokenCompartilhamento: token,
    restricao: link.restricao,
    permiteGestao: link.modalidade === 'completo',
    permiteAdministracao: false,
    exibeArquivadas: link.incluirArquivadas,
    nomePresenca: link.padrao ? null : link.nome,
    animalPresenca: link.animal,
    escopoAparencia: link.padrao ? ESCOPO_BOARD : escopoDoLink(link.linkId),
    permiteAparencia: !link.padrao,
  };
}

// Autor gravado no histórico das alterações feitas por este acesso: o
// usuário da sessão ou o nome do link completo.
export function montarOrigemAlteracao(acesso: AcessoPainel): OrigemAlteracao {
  return criarOrigemAlteracao(
    acesso.tipo === 'administrador' ? 'painel' : 'link',
    acesso.identificacao,
  );
}

export function extrairContextoNavegacao(
  acesso: AcessoPainel,
): ContextoNavegacao {
  return {
    prefixoRotas: acesso.prefixoRotas,
    tokenCompartilhamento: acesso.tokenCompartilhamento,
    somenteLeitura: !acesso.permiteGestao,
  };
}

export function montarRotaDoAcesso(acesso: AcessoPainel, rota: string): string {
  return aplicarPrefixo(acesso.prefixoRotas, rota);
}

export async function obterAcessoAdministrativo(): Promise<AcessoPainel> {
  const sessao = await exigirSessaoAdministrativa();
  return criarAcessoAdministrativo(sessao.usuario);
}

// Memorizado por requisição: layout, página e ação de um mesmo envio
// conferem o token uma vez só, mas toda requisição nova confere de novo.
const obterLinkCompartilhado = cache(
  async (token: string): Promise<LinkValidado | null> => {
    if (!ehFormatoTokenCompartilhamento(token)) {
      return null;
    }
    if ((await obterEstadoInstalacao()) !== 'pronta') {
      return null;
    }
    return validarTokenCompartilhamento(obterBancoAplicacao(), token);
  },
);

// Token inexistente, revogado ou expirado recebem a mesma resposta: a página
// fixa de link indisponível, sem nada do board.
export async function exigirAcessoCompartilhado(
  token: string,
): Promise<AcessoPainel> {
  const link = await obterLinkCompartilhado(token);
  if (!link) {
    redirect(ROTAS.COMPARTILHAMENTO_INDISPONIVEL);
  }
  return criarAcessoCompartilhado(token, link);
}

// Para rotas de arquivo (download), que respondem 404 em vez de redirecionar.
export async function obterAcessoCompartilhadoOuNulo(
  token: string,
): Promise<AcessoPainel | null> {
  const link = await obterLinkCompartilhado(token);
  return link ? criarAcessoCompartilhado(token, link) : null;
}

// Telas de edição e gestão num link restrito respondem como inexistentes.
export async function exigirGestaoCompartilhada(
  token: string,
): Promise<AcessoPainel> {
  const acesso = await exigirAcessoCompartilhado(token);
  if (!acesso.permiteGestao) {
    notFound();
  }
  return acesso;
}

// A tela de aparência de um link: o link padrão (público) não personaliza.
export async function exigirAparenciaCompartilhada(
  token: string,
): Promise<AcessoPainel> {
  const acesso = await exigirAcessoCompartilhado(token);
  if (!acesso.permiteAparencia) {
    notFound();
  }
  return acesso;
}

export async function exigirArquivadasCompartilhadas(
  token: string,
): Promise<AcessoPainel> {
  const acesso = await exigirAcessoCompartilhado(token);
  if (!acesso.exibeArquivadas) {
    notFound();
  }
  return acesso;
}

function ehCredencialAusente(credencial: unknown): boolean {
  return credencial === null || credencial === undefined || credencial === '';
}

// Primeira instrução de toda Server Action de gestão. Sem credencial de
// link, vale a sessão administrativa (cookie). Com credencial, ela precisa
// ser um link completo válido nesta requisição: link restrito volta ao
// quadro somente leitura e link inválido vai para a página de indisponível,
// sempre sem gravar nada. Links, tokens de API e credenciais não passam por
// aqui: as ações deles exigem só a sessão administrativa.
export async function exigirAcessoGestao(
  credencial: unknown,
): Promise<AcessoPainel> {
  if (ehCredencialAusente(credencial)) {
    return obterAcessoAdministrativo();
  }
  const token = typeof credencial === 'string' ? credencial : '';
  const link = await obterLinkCompartilhado(token);
  if (!link) {
    redirect(ROTAS.COMPARTILHAMENTO_INDISPONIVEL);
  }
  const acesso = criarAcessoCompartilhado(token, link);
  if (!acesso.permiteGestao) {
    redirect(acesso.prefixoRotas);
  }
  return acesso;
}

// Primeira instrução das Server Actions de aparência. Sem credencial de link,
// vale a sessão administrativa e a alteração vai para o board. Com
// credencial, ela precisa ser um link nomeado válido (completo ou restrito) e
// a alteração vale só para ele; o link padrão volta ao quadro sem gravar.
export async function exigirAcessoAparencia(
  credencial: unknown,
): Promise<AcessoPainel> {
  if (ehCredencialAusente(credencial)) {
    return obterAcessoAdministrativo();
  }
  const token = typeof credencial === 'string' ? credencial : '';
  const link = await obterLinkCompartilhado(token);
  if (!link) {
    redirect(ROTAS.COMPARTILHAMENTO_INDISPONIVEL);
  }
  const acesso = criarAcessoCompartilhado(token, link);
  if (!acesso.permiteAparencia) {
    redirect(acesso.prefixoRotas);
  }
  return acesso;
}
