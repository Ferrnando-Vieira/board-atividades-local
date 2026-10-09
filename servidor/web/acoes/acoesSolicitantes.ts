'use server';

import { CAMPOS_SOLICITANTE } from '@/config/camposFormulario';
import { esquemaNovoSolicitante } from '@/servidor/classificacao/esquemasSolicitantes';
import { mensagensSolicitantes as mensagens } from '@/servidor/classificacao/mensagensSolicitantes';
import { alterarSolicitantePadrao } from '@/servidor/classificacao/solicitantesServico';
import { exigirSessaoAdministrativa } from '@/servidor/web/acessoAdministrativo';
import {
  estadoDeFalhaNegocio,
  estadoDeFalhaValidacao,
  estadoDeSucesso,
  revalidarPainel,
} from '@/servidor/web/acoes/suporteAcoes';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import type { EstadoFormularioGestao } from '@/types/formulario';
import { lerValoresFormulario } from '@/util/FormularioUtils';

const CAMPOS_SOLICITANTE_PADRAO = [CAMPOS_SOLICITANTE.NOME] as const;

// Configuração do board: só o proprietário altera, nunca um link.
export async function salvarSolicitantePadraoFormulario(
  estado: EstadoFormularioGestao,
  dados: FormData,
): Promise<EstadoFormularioGestao> {
  await exigirSessaoAdministrativa();
  const valores = lerValoresFormulario(dados, CAMPOS_SOLICITANTE_PADRAO);
  const validacao = esquemaNovoSolicitante.safeParse(valores);
  if (!validacao.success) {
    return estadoDeFalhaValidacao(
      estado,
      valores,
      validacao.error,
      mensagens.corrijaCampo,
    );
  }
  try {
    alterarSolicitantePadrao(obterBancoAplicacao(), validacao.data);
  } catch (erro) {
    return estadoDeFalhaNegocio(estado, valores, erro);
  }
  revalidarPainel();
  return estadoDeSucesso(estado, mensagens.padraoSalvo);
}
