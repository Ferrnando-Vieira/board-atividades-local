import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CAMPOS_ACESSO } from '@/config/camposFormulario';
import { publicarAlteracaoBoard } from '@/servidor/tempoReal/alteracoesBoard';
import type { ResultadoAcao } from '@/types/acoes';
import type {
  EstadoFormularioGestao,
  ValoresFormulario,
} from '@/types/formulario';
import { ehErroApp, ErroApp, STATUS_ERRO } from '@/util/ErroApp';

export const CODIGO_DADOS_INVALIDOS = 'dados-invalidos';

const CAMINHO_RAIZ = '/';

// Toda tela do painel lê o mesmo banco; invalidar a partir do layout raiz
// atualiza a rota atual na própria resposta da ação e descarta o cache das
// demais telas já visitadas. As outras abas abertas recebem o aviso por SSE.
export function revalidarPainel(): void {
  revalidatePath(CAMINHO_RAIZ, 'layout');
  publicarAlteracaoBoard();
}

// Mudança que só vale para quem a fez (como a aparência própria de um link):
// atualiza a resposta desta ação sem avisar as outras abas do board.
export function revalidarPainelLocal(): void {
  revalidatePath(CAMINHO_RAIZ, 'layout');
}

// Só erros de negócio (4xx) voltam para a tela. Os demais são inesperados e
// seguem para o error boundary, com a stack preservada no servidor.
function ehFalhaEsperada(erro: unknown): erro is ErroApp {
  return ehErroApp(erro) && erro.status < STATUS_ERRO.INTERNO;
}

export function converterFalhaEmResultado(erro: unknown): ResultadoAcao {
  if (!ehFalhaEsperada(erro)) {
    throw erro;
  }
  return { ok: false, codigo: erro.codigo, mensagem: erro.message };
}

export function resultadoDadosInvalidos(mensagem: string): ResultadoAcao {
  return { ok: false, codigo: CODIGO_DADOS_INVALIDOS, mensagem };
}

export function estadoDeFalhaValidacao(
  anterior: EstadoFormularioGestao,
  valores: ValoresFormulario,
  erro: z.ZodError,
  mensagemPadrao: string,
): EstadoFormularioGestao {
  const { formErrors, fieldErrors } = z.flattenError(erro);
  return {
    tentativa: anterior.tentativa + 1,
    valores,
    mensagemErro: formErrors[0] ?? mensagemPadrao,
    errosCampos: fieldErrors,
  };
}

export function estadoDeFalhaNegocio(
  anterior: EstadoFormularioGestao,
  valores: ValoresFormulario,
  erro: unknown,
): EstadoFormularioGestao {
  if (!ehFalhaEsperada(erro)) {
    throw erro;
  }
  return {
    tentativa: anterior.tentativa + 1,
    valores,
    mensagemErro: erro.message,
  };
}

export function estadoDeSucesso(
  anterior: EstadoFormularioGestao,
  mensagemSucesso: string,
): EstadoFormularioGestao {
  return { tentativa: anterior.tentativa + 1, mensagemSucesso };
}

export function lerCredencialFormulario(dados: FormData): unknown {
  return dados.get(CAMPOS_ACESSO.TOKEN_COMPARTILHAMENTO);
}
