'use server';

import { obterAmbiente } from '@/config/ambiente';
import {
  CAMPOS_FUNDO,
  CAMPOS_PRIORIDADES,
  CAMPOS_SUPERFICIES,
} from '@/config/camposFormulario';
import { LIMITES_IMAGEM_FUNDO } from '@/config/fundosBoard';
import { CODIGOS_ANEXO } from '@/servidor/anexos/validacaoAnexos';
import {
  esquemaCoresPrioridade,
  esquemaSuperficies,
  mensagensAparencia,
  salvarCoresPrioridade,
  salvarSuperficies,
} from '@/servidor/board/aparenciaBoard';
import {
  alterarFundoBoard,
  esquemaFundoBoard,
  esquemaGradientePersonalizado,
  mensagensFundo as mensagens,
  removerImagemFundo,
  restaurarAparenciaDoBoard,
  salvarGradientePersonalizado,
  salvarImagemFundo,
} from '@/servidor/board/fundoBoard';
import {
  estadoDeFalhaNegocio,
  estadoDeFalhaValidacao,
  estadoDeSucesso,
  lerCredencialFormulario,
  revalidarPainel,
  revalidarPainelLocal,
} from '@/servidor/web/acoes/suporteAcoes';
import {
  exigirAcessoAparencia,
  type AcessoPainel,
} from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type { EstadoFormularioGestao } from '@/types/formulario';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { lerValoresFormulario } from '@/util/FormularioUtils';

const SEM_VALORES = {};

const CAMPOS_DE_SUPERFICIES = Object.values(CAMPOS_SUPERFICIES);
const CAMPOS_DE_PRIORIDADES = Object.values(CAMPOS_PRIORIDADES);

const CAMPOS_GRADIENTE = [
  CAMPOS_FUNDO.FORMATO,
  CAMPOS_FUNDO.ANGULO,
  CAMPOS_FUNDO.COR_INICIAL,
  CAMPOS_FUNDO.USAR_COR_INTERMEDIARIA,
  CAMPOS_FUNDO.COR_INTERMEDIARIA,
  CAMPOS_FUNDO.COR_FINAL,
] as const;

// Sem arquivo escolhido o navegador envia um File vazio e sem nome. O limite
// de tamanho é conferido antes de ler o conteúdo para a memória.
function lerImagemEnviada(dados: FormData): File {
  const arquivo = dados.get(CAMPOS_FUNDO.IMAGEM);
  if (!(arquivo instanceof File) || arquivo.name === '' || arquivo.size === 0) {
    throw new ErroApp(mensagens.imagemAusente, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ANEXO.ARQUIVO_AUSENTE,
    });
  }
  if (arquivo.size > LIMITES_IMAGEM_FUNDO.TAMANHO_MAXIMO_BYTES) {
    throw new ErroApp(mensagens.imagemGrande, {
      status: STATUS_ERRO.CORPO_GRANDE_DEMAIS,
      codigo: CODIGOS_ANEXO.ARQUIVO_GRANDE,
    });
  }
  return arquivo;
}

async function exigirAcesso(dados: FormData): Promise<AcessoPainel> {
  return exigirAcessoAparencia(lerCredencialFormulario(dados));
}

// A aparência do board muda para todos, que recebem o aviso; a de um link
// só para quem entra por ele.
function revalidarAparencia(acesso: AcessoPainel): void {
  if (acesso.escopoAparencia.tipo === 'board') {
    revalidarPainel();
  } else {
    revalidarPainelLocal();
  }
}

// Sem credencial de link, a ação exige a sessão administrativa e altera a
// aparência do board; com a credencial de um link nomeado, altera só a
// aparência daquele link (ver exigirAcessoAparencia).
export async function salvarFundoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcesso(dados);
  const valores = lerValoresFormulario(dados, [CAMPOS_FUNDO.FUNDO]);
  const validacao = esquemaFundoBoard.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.fundoInvalido,
    );
  }
  try {
    alterarFundoBoard(
      obterBancoAplicacao(),
      validacao.data,
      obterAmbiente().diretorioAnexos,
      acesso.escopoAparencia,
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarAparencia(acesso);
  return estadoDeSucesso(estado, mensagens.fundoSalvo);
}

export async function salvarGradienteFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcesso(dados);
  const valores = lerValoresFormulario(dados, CAMPOS_GRADIENTE);
  const validacao = esquemaGradientePersonalizado.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  try {
    salvarGradientePersonalizado(
      obterBancoAplicacao(),
      validacao.data,
      obterAmbiente().diretorioAnexos,
      acesso.escopoAparencia,
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarAparencia(acesso);
  return estadoDeSucesso(estado, mensagens.gradienteSalvo);
}

export async function enviarImagemFundoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcesso(dados);
  try {
    const arquivo = lerImagemEnviada(dados);
    const corMedia = dados.get(CAMPOS_FUNDO.COR_MEDIA_IMAGEM);
    salvarImagemFundo(
      obterBancoAplicacao(),
      obterAmbiente().diretorioAnexos,
      {
        nomeArquivo: arquivo.name,
        conteudo: new Uint8Array(await arquivo.arrayBuffer()),
        corMedia: typeof corMedia === 'string' ? corMedia : null,
      },
      acesso.escopoAparencia,
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, SEM_VALORES, erro);
  }
  revalidarAparencia(acesso);
  return estadoDeSucesso(estado, mensagens.imagemSalva);
}

export async function removerImagemFundoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcesso(dados);
  try {
    removerImagemFundo(
      obterBancoAplicacao(),
      obterAmbiente().diretorioAnexos,
      acesso.escopoAparencia,
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, SEM_VALORES, erro);
  }
  revalidarAparencia(acesso);
  return estadoDeSucesso(estado, mensagens.imagemRemovida);
}

// Só um link com aparência própria volta a seguir a do board.
export async function restaurarAparenciaBoardFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcesso(dados);
  const escopo = acesso.escopoAparencia;
  try {
    if (escopo.tipo !== 'link') {
      throw new ErroApp(mensagens.restaurarSoNoLink, {
        status: STATUS_ERRO.REQUISICAO_INVALIDA,
        codigo: 'restauracao-sem-link',
      });
    }
    restaurarAparenciaDoBoard(
      obterBancoAplicacao(),
      obterAmbiente().diretorioAnexos,
      escopo.linkId,
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, SEM_VALORES, erro);
  }
  revalidarAparencia(acesso);
  return estadoDeSucesso(estado, mensagens.aparenciaRestaurada);
}

export async function salvarSuperficiesFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcesso(dados);
  const valores = lerValoresFormulario(dados, CAMPOS_DE_SUPERFICIES);
  const validacao = esquemaSuperficies.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagensAparencia.corrijaCampos,
    );
  }
  try {
    salvarSuperficies(
      obterBancoAplicacao(),
      validacao.data,
      acesso.escopoAparencia,
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarAparencia(acesso);
  return estadoDeSucesso(estado, mensagensAparencia.superficiesSalvas);
}

export async function salvarCoresPrioridadeFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcesso(dados);
  const valores = lerValoresFormulario(dados, CAMPOS_DE_PRIORIDADES);
  const validacao = esquemaCoresPrioridade.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagensAparencia.corrijaCampos,
    );
  }
  try {
    salvarCoresPrioridade(
      obterBancoAplicacao(),
      validacao.data,
      acesso.escopoAparencia,
    );
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarAparencia(acesso);
  return estadoDeSucesso(estado, mensagensAparencia.prioridadesSalvas);
}
