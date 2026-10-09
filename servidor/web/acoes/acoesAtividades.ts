'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  CAMPOS_ATIVIDADE,
  RETORNOS_RESTAURACAO,
  type RetornoRestauracao,
} from '@/config/camposFormulario';
import {
  adicionarAviso,
  aplicarPrefixo,
  AVISOS,
  montarRotaAtividade,
  ROTAS,
} from '@/config/rotas';
import { obterAmbiente } from '@/config/ambiente';
import type {
  ArquivoPendente,
  ArquivosPendentes,
} from '@/servidor/anexos/anexosServico';
import { mensagensAnexos } from '@/servidor/anexos/mensagensAnexos';
import { CODIGOS_ANEXO } from '@/servidor/anexos/validacaoAnexos';
import {
  arquivarAtividade,
  criarAtividade,
  desarquivarAtividade,
  desvincularTagAtividade,
  editarAtividade,
  moverAtividadeParaPosicao,
  vincularTagAtividade,
} from '@/servidor/atividades/atividadesServico';
import {
  CAMPOS_LISTA_ATIVIDADE,
  CAMPOS_TEXTO_ATIVIDADE,
  esquemaArquivamentoAtividade,
  esquemaDesvinculoTag,
  esquemaEdicaoAtividade,
  esquemaMovimentoPorPosicao,
  esquemaNovaAtividade,
  esquemaVinculoTag,
} from '@/servidor/atividades/esquemasAtividades';
import { mensagensAtividades as mensagens } from '@/servidor/atividades/mensagensAtividades';
import {
  converterFalhaEmResultado,
  estadoDeFalhaNegocio,
  estadoDeFalhaValidacao,
  estadoDeSucesso,
  lerCredencialFormulario,
  resultadoDadosInvalidos,
  revalidarPainel,
} from '@/servidor/web/acoes/suporteAcoes';
import {
  exigirAcessoGestao,
  montarOrigemAlteracao,
} from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type { ResultadoAcao } from '@/types/acoes';
import type { EstadoFormularioGestao } from '@/types/formulario';
import { listarChavesAnexosNovos } from '@/util/DescricaoUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { lerValoresFormulario } from '@/util/FormularioUtils';

const CAMPOS_ARQUIVAMENTO = [
  CAMPOS_ATIVIDADE.ATIVIDADE_ID,
  CAMPOS_ATIVIDADE.VERSAO,
] as const;

const esquemaRetorno = z
  .enum([RETORNOS_RESTAURACAO.ARQUIVADAS, RETORNOS_RESTAURACAO.DETALHE])
  .catch(RETORNOS_RESTAURACAO.DETALHE);

function lerFormularioAtividade(dados: FormData) {
  return lerValoresFormulario(
    dados,
    CAMPOS_TEXTO_ATIVIDADE,
    CAMPOS_LISTA_ATIVIDADE,
  );
}

function erroArquivosInvalidos(): ErroApp {
  return new ErroApp(mensagensAnexos.dadosInvalidos, {
    status: STATUS_ERRO.REQUISICAO_INVALIDA,
    codigo: CODIGOS_ANEXO.REFERENCIA_INVALIDA,
  });
}

// Anexos escolhidos na criação e imagens coladas na descrição chegam com o
// formulário, cada arquivo com a chave na mesma posição (vazia para anexo
// comum). Imagem cuja referência saiu do texto antes de salvar é descartada.
// Tamanho, quantidade, tipo e conteúdo são conferidos no serviço.
async function lerArquivosPendentes(
  dados: FormData,
  descricao: string | null,
): Promise<ArquivosPendentes | null> {
  const arquivos = dados.getAll(CAMPOS_ATIVIDADE.ARQUIVOS);
  const chaves = dados.getAll(CAMPOS_ATIVIDADE.CHAVES_ARQUIVOS);
  if (arquivos.length !== chaves.length) {
    throw erroArquivosInvalidos();
  }
  const referenciadas = new Set(listarChavesAnexosNovos(descricao ?? ''));
  const pendentes: ArquivoPendente[] = [];
  for (const [indice, arquivo] of arquivos.entries()) {
    const chave = chaves[indice];
    if (!(arquivo instanceof File) || typeof chave !== 'string') {
      throw erroArquivosInvalidos();
    }
    if (chave !== '' && !referenciadas.has(chave)) {
      continue;
    }
    pendentes.push({
      nomeArquivo: arquivo.name,
      conteudo: new Uint8Array(await arquivo.arrayBuffer()),
      chave: chave === '' ? null : chave,
    });
  }
  return pendentes.length === 0
    ? null
    : { diretorioAnexos: obterAmbiente().diretorioAnexos, arquivos: pendentes };
}

type ResultadoCriacao =
  | { ok: true; prefixoRotas: string }
  | { ok: false; estado: EstadoFormularioGestao };

async function executarCriacao(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<ResultadoCriacao> {
  const acesso = await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerFormularioAtividade(dados);
  const validacao = esquemaNovaAtividade.safeParse(valores);
  if (!validacao.success) {
    return {
      ok: false,
      estado: estadoDeFalhaValidacao(
        estado,
        valores,
        validacao.error,
        mensagens.corrijaCampos,
      ),
    };
  }
  try {
    criarAtividade(
      obterBancoAplicacao(),
      {
        ...validacao.data,
        solicitante: validacao.data.solicitante ?? acesso.solicitantePadrao,
      },
      new Date(),
      montarOrigemAlteracao(acesso),
      await lerArquivosPendentes(dados, validacao.data.descricao),
    );
  } catch (erro) {
    return { ok: false, estado: estadoDeFalhaNegocio(estado, valores, erro) };
  }
  revalidarPainel();
  return { ok: true, prefixoRotas: acesso.prefixoRotas };
}

export async function criarAtividadeFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const resultado = await executarCriacao(estado, dados);
  if (!resultado.ok) {
    return resultado.estado;
  }
  redirect(
    adicionarAviso(
      aplicarPrefixo(resultado.prefixoRotas, ROTAS.INICIO),
      AVISOS.ATIVIDADE_CRIADA,
    ),
  );
}

// Usada pelo modal do quadro: sem redirecionamento, a resposta da própria
// ação já traz o quadro revalidado e a tela (com os filtros) continua igual.
export async function criarAtividadeNoQuadro(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const resultado = await executarCriacao(estado, dados);
  return resultado.ok
    ? estadoDeSucesso(estado, mensagens.atividadeCriada)
    : resultado.estado;
}

type ResultadoEdicao =
  | { ok: true; atividadeId: number; prefixoRotas: string }
  | { ok: false; estado: EstadoFormularioGestao };

async function executarEdicao(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<ResultadoEdicao> {
  const acesso = await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerFormularioAtividade(dados);
  const validacao = esquemaEdicaoAtividade.safeParse(valores);
  if (!validacao.success) {
    return {
      ok: false,
      estado: estadoDeFalhaValidacao(
        estado,
        valores,
        validacao.error,
        mensagens.corrijaCampos,
      ),
    };
  }
  try {
    editarAtividade(
      obterBancoAplicacao(),
      validacao.data,
      new Date(),
      montarOrigemAlteracao(acesso),
      await lerArquivosPendentes(dados, validacao.data.descricao),
    );
  } catch (erro) {
    return { ok: false, estado: estadoDeFalhaNegocio(estado, valores, erro) };
  }
  revalidarPainel();
  return {
    ok: true,
    atividadeId: validacao.data.atividadeId,
    prefixoRotas: acesso.prefixoRotas,
  };
}

// Página de edição (endereço direto): salva e volta para o detalhe.
export async function editarAtividadeFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const resultado = await executarEdicao(estado, dados);
  if (!resultado.ok) {
    return resultado.estado;
  }
  redirect(
    adicionarAviso(
      montarRotaAtividade(resultado.atividadeId, resultado.prefixoRotas),
      AVISOS.ATIVIDADE_SALVA,
    ),
  );
}

// Edição feita no próprio detalhe (no modal do quadro ou na página): sem
// redirecionamento, a resposta da ação já traz o detalhe e o quadro
// revalidados, e quem chamou volta à visualização.
export async function editarAtividadeNoDetalhe(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const resultado = await executarEdicao(estado, dados);
  return resultado.ok
    ? estadoDeSucesso(estado, mensagens.atividadeSalva)
    : resultado.estado;
}

// Chamada pelo quadro dentro de uma transição. Também em caso de falha a rota
// é revalidada, para que o quadro mostre de imediato o estado gravado. O
// segundo argumento é a credencial do link completo (ausente no painel). A
// carga traz só o status de destino: a posição na coluna é automática, e o
// quadro filtrado não conhece os cartões ocultos da coluna de destino.
export async function moverAtividadeNoQuadro(
  entrada: unknown,
  credencial?: unknown,
): Promise<ResultadoAcao> {
  const acesso = await exigirAcessoGestao(credencial);
  const validacao = esquemaMovimentoPorPosicao.safeParse(entrada);
  if (!validacao.success) {
    return resultadoDadosInvalidos(mensagens.dadosInvalidos);
  }
  try {
    moverAtividadeParaPosicao(
      obterBancoAplicacao(),
      validacao.data,
      new Date(),
      montarOrigemAlteracao(acesso),
    );
  } catch (erro) {
    revalidarPainel();
    return converterFalhaEmResultado(erro);
  }
  revalidarPainel();
  return { ok: true };
}

function primeiraMensagem(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? mensagens.dadosInvalidos;
}

// Tags rápidas do cartão seguem a mesma regra de acesso das demais ações de
// gestão: painel ou link completo; link restrito nunca grava.
export async function adicionarTagNoQuadro(
  entrada: unknown,
  credencial?: unknown,
): Promise<ResultadoAcao> {
  const acesso = await exigirAcessoGestao(credencial);
  const validacao = esquemaVinculoTag.safeParse(entrada);
  if (!validacao.success) {
    return resultadoDadosInvalidos(primeiraMensagem(validacao.error));
  }
  try {
    vincularTagAtividade(
      obterBancoAplicacao(),
      validacao.data,
      new Date(),
      montarOrigemAlteracao(acesso),
    );
  } catch (erro) {
    revalidarPainel();
    return converterFalhaEmResultado(erro);
  }
  revalidarPainel();
  return { ok: true };
}

export async function removerTagNoQuadro(
  entrada: unknown,
  credencial?: unknown,
): Promise<ResultadoAcao> {
  const acesso = await exigirAcessoGestao(credencial);
  const validacao = esquemaDesvinculoTag.safeParse(entrada);
  if (!validacao.success) {
    return resultadoDadosInvalidos(mensagens.dadosInvalidos);
  }
  try {
    desvincularTagAtividade(
      obterBancoAplicacao(),
      validacao.data,
      new Date(),
      montarOrigemAlteracao(acesso),
    );
  } catch (erro) {
    revalidarPainel();
    return converterFalhaEmResultado(erro);
  }
  revalidarPainel();
  return { ok: true };
}

export async function arquivarAtividadeFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, CAMPOS_ARQUIVAMENTO);
  const validacao = esquemaArquivamentoAtividade.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    arquivarAtividade(
      obterBancoAplicacao(),
      validacao.data,
      new Date(),
      montarOrigemAlteracao(acesso),
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  redirect(
    adicionarAviso(
      aplicarPrefixo(acesso.prefixoRotas, ROTAS.INICIO),
      AVISOS.ATIVIDADE_ARQUIVADA,
    ),
  );
}

function montarRotaAposRestaurar(
  retorno: RetornoRestauracao,
  atividadeId: number,
  prefixo: string,
): string {
  const rota =
    retorno === RETORNOS_RESTAURACAO.ARQUIVADAS
      ? aplicarPrefixo(prefixo, ROTAS.ARQUIVADAS)
      : montarRotaAtividade(atividadeId, prefixo);
  return adicionarAviso(rota, AVISOS.ATIVIDADE_RESTAURADA);
}

export async function desarquivarAtividadeFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, CAMPOS_ARQUIVAMENTO);
  const validacao = esquemaArquivamentoAtividade.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    desarquivarAtividade(
      obterBancoAplicacao(),
      validacao.data,
      new Date(),
      montarOrigemAlteracao(acesso),
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  redirect(
    montarRotaAposRestaurar(
      esquemaRetorno.parse(dados.get(CAMPOS_ATIVIDADE.RETORNO)),
      validacao.data.atividadeId,
      acesso.prefixoRotas,
    ),
  );
}
