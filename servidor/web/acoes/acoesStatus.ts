'use server';

import { redirect } from 'next/navigation';
import { CAMPOS_STATUS } from '@/config/camposFormulario';
import { adicionarAviso, aplicarPrefixo, AVISOS, ROTAS } from '@/config/rotas';
import {
  esquemaEdicaoStatus,
  esquemaExclusaoStatus,
  esquemaNovoStatus,
  esquemaReordenacaoStatus,
} from '@/servidor/board/esquemasStatus';
import { mensagensStatus as mensagens } from '@/servidor/board/mensagensStatus';
import {
  criarStatus,
  editarStatus,
  excluirStatus,
  reordenarStatus,
} from '@/servidor/board/statusServico';
import {
  converterFalhaEmResultado,
  estadoDeFalhaNegocio,
  estadoDeFalhaValidacao,
  estadoDeSucesso,
  lerCredencialFormulario,
  resultadoDadosInvalidos,
  revalidarPainel,
} from '@/servidor/web/acoes/suporteAcoes';
import { exigirAcessoGestao } from '@/servidor/web/acessoPainel';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type { ResultadoAcao } from '@/types/acoes';
import type { EstadoFormularioGestao } from '@/types/formulario';
import { lerValoresFormulario } from '@/util/FormularioUtils';

const CAMPOS_NOVO_STATUS = [
  CAMPOS_STATUS.NOME,
  CAMPOS_STATUS.FINALIZA,
  CAMPOS_STATUS.COR_TITULO,
  CAMPOS_STATUS.COR_COLUNA,
] as const;
const CAMPOS_EDICAO_STATUS = [
  CAMPOS_STATUS.STATUS_ID,
  CAMPOS_STATUS.VERSAO,
  CAMPOS_STATUS.NOME,
  CAMPOS_STATUS.FINALIZA,
  CAMPOS_STATUS.COR_TITULO,
  CAMPOS_STATUS.COR_COLUNA,
] as const;
const CAMPOS_EXCLUSAO_STATUS = [
  CAMPOS_STATUS.STATUS_ID,
  CAMPOS_STATUS.VERSAO,
  CAMPOS_STATUS.DESTINO,
] as const;

export async function criarStatusFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, CAMPOS_NOVO_STATUS);
  const validacao = esquemaNovoStatus.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  try {
    criarStatus(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.statusCriado);
}

export async function editarStatusFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, CAMPOS_EDICAO_STATUS);
  const validacao = esquemaEdicaoStatus.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampos,
    );
  }
  try {
    editarStatus(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.statusSalvo);
}

// O status excluído some da lista; por isso o aviso vai para a página, e não
// para o formulário que acabou de ser desmontado.
export async function excluirStatusFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  const acesso = await exigirAcessoGestao(lerCredencialFormulario(dados));
  const valores = lerValoresFormulario(dados, CAMPOS_EXCLUSAO_STATUS);
  const validacao = esquemaExclusaoStatus.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.dadosInvalidos,
    );
  }
  try {
    excluirStatus(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  redirect(
    adicionarAviso(
      aplicarPrefixo(acesso.prefixoRotas, ROTAS.STATUS),
      AVISOS.STATUS_EXCLUIDO,
    ),
  );
}

export async function reordenarStatusNoQuadro(
  entrada: unknown,
  credencial?: unknown,
): Promise<ResultadoAcao> {
  await exigirAcessoGestao(credencial);
  const validacao = esquemaReordenacaoStatus.safeParse(entrada);
  if (!validacao.success) {
    return resultadoDadosInvalidos(mensagens.dadosInvalidos);
  }
  try {
    reordenarStatus(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    revalidarPainel();
    return converterFalhaEmResultado(erro);
  }
  revalidarPainel();
  return { ok: true };
}
