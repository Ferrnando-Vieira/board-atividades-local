'use server';

import {
  CAMPOS_LEMBRETE,
  CAMPOS_LEMBRETE_AVULSO,
} from '@/config/camposFormulario';
import { FUSO_HORARIO_PADRAO, LEMBRETES } from '@/config/constantes';
import { montarRotaAtividade } from '@/config/rotas';
import type { BancoDados } from '@/servidor/banco/conexao';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  esquemaAlteracaoLembrete,
  esquemaAlteracaoLembreteAvulso,
  esquemaDefinicaoLembrete,
  esquemaDispensaLembrete,
  esquemaDispensaLembreteAvulso,
  esquemaEdicaoLembreteAvulso,
  esquemaNovoLembreteAvulso,
  type AlteracaoLembrete,
  type AlteracaoLembreteAvulso,
} from '@/servidor/lembretes/esquemasLembretes';
import {
  cancelarLembreteAvulso,
  criarLembreteAvulso,
  dispararLembretesAvulsosVencidos,
  dispensarLembreteAvulso,
  editarLembreteAvulso,
  excluirLembreteAvulso,
  listarLembretesAvulsosADispensar,
  listarProximosLembretesAvulsos,
  reativarLembreteAvulso,
  type LembreteAvulso,
  type NotificacaoLembreteAvulso,
} from '@/servidor/lembretes/lembretesAvulsosServico';
import {
  listarProximosLembretesAtividades,
  type LembretePendente,
} from '@/servidor/lembretes/lembretesRepositorio';
import {
  ativarLembrete,
  definirLembrete,
  desativarLembrete,
  dispensarLembrete,
  excluirLembrete,
  sincronizarLembretes,
  type LembreteGravado,
  type NotificacaoLembrete,
} from '@/servidor/lembretes/lembretesServico';
import { mensagensLembretes as mensagens } from '@/servidor/lembretes/mensagensLembretes';
import { exigirSessaoAdministrativa } from '@/servidor/web/acessoAdministrativo';
import {
  estadoDeFalhaNegocio,
  estadoDeFalhaValidacao,
  estadoDeSucesso,
  resultadoDadosInvalidos,
  revalidarPainel,
} from '@/servidor/web/acoes/suporteAcoes';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type { ResultadoAcao } from '@/types/acoes';
import type { EstadoFormularioGestao } from '@/types/formulario';
import type {
  LembreteProximoExibido,
  NotificacaoLembreteExibida,
  ResultadoSincronizacaoLembretes,
} from '@/types/lembretes';
import { formatarInstanteParaExibicao } from '@/util/DataUtils';
import { lerValoresFormulario } from '@/util/FormularioUtils';
import {
  montarChaveNotificacaoLembrete,
  montarChaveNotificacaoLembreteAvulso,
} from '@/util/LembreteUtils';

const CAMPOS_DEFINICAO = [
  CAMPOS_LEMBRETE.ATIVIDADE_ID,
  CAMPOS_LEMBRETE.VERSAO,
  CAMPOS_LEMBRETE.DATA,
  CAMPOS_LEMBRETE.HORA,
];

const CAMPOS_ALTERACAO = [CAMPOS_LEMBRETE.ATIVIDADE_ID, CAMPOS_LEMBRETE.VERSAO];

const CAMPOS_NOVO_AVULSO = [
  CAMPOS_LEMBRETE_AVULSO.TITULO,
  CAMPOS_LEMBRETE_AVULSO.OBSERVACAO,
  CAMPOS_LEMBRETE_AVULSO.DATA,
  CAMPOS_LEMBRETE_AVULSO.HORA,
];

const CAMPOS_EDICAO_AVULSO = [
  CAMPOS_LEMBRETE_AVULSO.LEMBRETE_ID,
  CAMPOS_LEMBRETE_AVULSO.VERSAO,
  ...CAMPOS_NOVO_AVULSO,
];

const CAMPOS_ALTERACAO_AVULSO = [
  CAMPOS_LEMBRETE_AVULSO.LEMBRETE_ID,
  CAMPOS_LEMBRETE_AVULSO.VERSAO,
];

type OperacaoLembrete = (
  banco: BancoDados,
  alteracao: AlteracaoLembrete,
) => LembreteGravado;

type OperacaoLembreteAvulso = (
  banco: BancoDados,
  alteracao: AlteracaoLembreteAvulso,
) => void;

// Lembretes são avisos do proprietário: todas as ações exigem a sessão
// administrativa e ignoram credencial de link. Link completo e restrito só
// veem a situação do lembrete no detalhe das atividades do seu escopo.
export async function salvarLembreteFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_DEFINICAO);
  const validacao = esquemaDefinicaoLembrete.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  try {
    definirLembrete(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.lembreteSalvo);
}

async function executarAlteracaoLembrete(
  estado: EstadoFormularioGestao,
  dados: FormData,
  operacao: OperacaoLembrete,
  mensagemSucesso: string,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_ALTERACAO);
  const validacao = esquemaAlteracaoLembrete.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    operacao(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagemSucesso);
}

export async function ativarLembreteFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  return executarAlteracaoLembrete(
    estado,
    dados,
    ativarLembrete,
    mensagens.lembreteAtivado,
  );
}

export async function desativarLembreteFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  return executarAlteracaoLembrete(
    estado,
    dados,
    desativarLembrete,
    mensagens.lembreteDesativado,
  );
}

export async function excluirLembreteFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  return executarAlteracaoLembrete(
    estado,
    dados,
    excluirLembrete,
    mensagens.lembreteExcluido,
  );
}

function exibirNotificacao(
  notificacao: NotificacaoLembrete,
  fusoHorario: string,
): NotificacaoLembreteExibida {
  return {
    chave: montarChaveNotificacaoLembrete(
      notificacao.atividadeId,
      notificacao.lembreteEm,
    ),
    origem: 'atividade',
    atividadeId: notificacao.atividadeId,
    lembreteAvulsoId: null,
    titulo: notificacao.titulo,
    observacao: null,
    lembreteEm: notificacao.lembreteEm,
    horarioExibido: formatarInstanteParaExibicao(
      notificacao.lembreteEm,
      fusoHorario,
    ),
    atrasado: notificacao.atrasado,
    rotaAtividade: montarRotaAtividade(notificacao.atividadeId),
  };
}

function exibirNotificacaoAvulsa(
  notificacao: NotificacaoLembreteAvulso,
  fusoHorario: string,
): NotificacaoLembreteExibida {
  return {
    chave: montarChaveNotificacaoLembreteAvulso(
      notificacao.lembreteId,
      notificacao.lembreteEm,
    ),
    origem: 'avulso',
    atividadeId: null,
    lembreteAvulsoId: notificacao.lembreteId,
    titulo: notificacao.titulo,
    observacao: notificacao.observacao,
    lembreteEm: notificacao.lembreteEm,
    horarioExibido: formatarInstanteParaExibicao(
      notificacao.lembreteEm,
      fusoHorario,
    ),
    atrasado: notificacao.atrasado,
    rotaAtividade: null,
  };
}

function exibirProximoDeAtividade(
  lembrete: LembretePendente,
  fusoHorario: string,
): LembreteProximoExibido {
  return {
    chave: montarChaveNotificacaoLembrete(
      lembrete.atividadeId,
      lembrete.lembreteEm,
    ),
    origem: 'atividade',
    atividadeId: lembrete.atividadeId,
    lembreteAvulsoId: null,
    titulo: lembrete.titulo,
    observacao: null,
    lembreteEm: lembrete.lembreteEm,
    horarioExibido: formatarInstanteParaExibicao(
      lembrete.lembreteEm,
      fusoHorario,
    ),
    rotaAtividade: montarRotaAtividade(lembrete.atividadeId),
  };
}

function exibirProximoAvulso(
  lembrete: LembreteAvulso,
  fusoHorario: string,
): LembreteProximoExibido {
  return {
    chave: montarChaveNotificacaoLembreteAvulso(
      lembrete.id,
      lembrete.lembreteEm,
    ),
    origem: 'avulso',
    atividadeId: null,
    lembreteAvulsoId: lembrete.id,
    titulo: lembrete.titulo,
    observacao: lembrete.observacao,
    lembreteEm: lembrete.lembreteEm,
    horarioExibido: formatarInstanteParaExibicao(
      lembrete.lembreteEm,
      fusoHorario,
    ),
    rotaAtividade: null,
  };
}

function compararPorInstante(
  primeiro: { lembreteEm: string },
  segundo: { lembreteEm: string },
): number {
  return primeiro.lembreteEm.localeCompare(segundo.lembreteEm);
}

// Chamada pela central de lembretes em intervalos e ao voltar para a aba.
// Junta os lembretes de atividade e os avulsos. Não revalida o painel: a
// central atualiza a própria lista e pede uma atualização da tela só quando
// algum aviso dispara.
export async function sincronizarLembretesNavegador(): Promise<ResultadoSincronizacaoLembretes> {
  await exigirSessaoAdministrativa();
  const banco = obterBancoAplicacao();
  const agora = new Date();
  const fusoHorario =
    buscarBoardPadrao(banco)?.fusoHorario ?? FUSO_HORARIO_PADRAO;
  const { novas, aDispensar } = sincronizarLembretes(banco, agora);
  const novasAvulsas = dispararLembretesAvulsosVencidos(banco, agora);
  const avulsasADispensar = listarLembretesAvulsosADispensar(banco);
  const proximos = [
    ...listarProximosLembretesAtividades(
      banco,
      agora,
      LEMBRETES.MAXIMO_PROXIMOS_LISTADOS,
    ).map((lembrete) => exibirProximoDeAtividade(lembrete, fusoHorario)),
    ...listarProximosLembretesAvulsos(
      banco,
      agora,
      LEMBRETES.MAXIMO_PROXIMOS_LISTADOS,
    ).map((lembrete) => exibirProximoAvulso(lembrete, fusoHorario)),
  ]
    .sort(compararPorInstante)
    .slice(0, LEMBRETES.MAXIMO_PROXIMOS_LISTADOS);
  return {
    novas: [
      ...novas.map((notificacao) =>
        exibirNotificacao(notificacao, fusoHorario),
      ),
      ...novasAvulsas.map((notificacao) =>
        exibirNotificacaoAvulsa(notificacao, fusoHorario),
      ),
    ],
    aDispensar: [
      ...aDispensar.map((notificacao) =>
        exibirNotificacao(notificacao, fusoHorario),
      ),
      ...avulsasADispensar.map((notificacao) =>
        exibirNotificacaoAvulsa(notificacao, fusoHorario),
      ),
    ]
      .sort((primeira, segunda) => compararPorInstante(segunda, primeira))
      .slice(0, LEMBRETES.MAXIMO_NOTIFICACOES_LISTADAS),
    proximos,
  };
}

export async function dispensarLembreteNotificacao(
  entrada: unknown,
): Promise<ResultadoAcao> {
  await exigirSessaoAdministrativa();
  const validacao = esquemaDispensaLembrete.safeParse(entrada);
  if (!validacao.success) {
    return resultadoDadosInvalidos(mensagens.dadosInvalidos);
  }
  dispensarLembrete(obterBancoAplicacao(), validacao.data);
  return { ok: true };
}

export async function dispensarLembreteAvulsoNotificacao(
  entrada: unknown,
): Promise<ResultadoAcao> {
  await exigirSessaoAdministrativa();
  const validacao = esquemaDispensaLembreteAvulso.safeParse(entrada);
  if (!validacao.success) {
    return resultadoDadosInvalidos(mensagens.dadosInvalidos);
  }
  dispensarLembreteAvulso(obterBancoAplicacao(), validacao.data);
  return { ok: true };
}

// Lembretes avulsos (sem atividade): também só do proprietário.
export async function criarLembreteAvulsoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_NOVO_AVULSO);
  const validacao = esquemaNovoLembreteAvulso.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  try {
    criarLembreteAvulso(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.lembreteAvulsoCriado);
}

export async function editarLembreteAvulsoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_EDICAO_AVULSO);
  const validacao = esquemaEdicaoLembreteAvulso.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  try {
    editarLembreteAvulso(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.lembreteAvulsoSalvo);
}

async function executarAlteracaoLembreteAvulso(
  estado: EstadoFormularioGestao,
  dados: FormData,
  operacao: OperacaoLembreteAvulso,
  mensagemSucesso: string,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_ALTERACAO_AVULSO);
  const validacao = esquemaAlteracaoLembreteAvulso.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    operacao(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagemSucesso);
}

export async function cancelarLembreteAvulsoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  return executarAlteracaoLembreteAvulso(
    estado,
    dados,
    cancelarLembreteAvulso,
    mensagens.lembreteDesativado,
  );
}

export async function reativarLembreteAvulsoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  return executarAlteracaoLembreteAvulso(
    estado,
    dados,
    (banco, alteracao) => reativarLembreteAvulso(banco, alteracao),
    mensagens.lembreteAtivado,
  );
}

export async function excluirLembreteAvulsoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  return executarAlteracaoLembreteAvulso(
    estado,
    dados,
    excluirLembreteAvulso,
    mensagens.lembreteExcluido,
  );
}
