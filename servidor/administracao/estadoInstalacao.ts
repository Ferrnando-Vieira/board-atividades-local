import type { BancoDados } from '@/servidor/banco/conexao';
import {
  contarMigracoesAplicadas,
  contarMigracoesDisponiveis,
} from '@/servidor/banco/migrador';
import { existeAdministrador } from '@/servidor/administracao/configuracaoInicial';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';

export type EstadoInstalacao =
  | 'banco-ausente'
  | 'migracoes-pendentes'
  | 'board-ausente'
  | 'configuracao-pendente'
  | 'pronta';

export function verificarEstadoInstalacao(
  banco: BancoDados,
  migracoesDisponiveis: number = contarMigracoesDisponiveis(),
): EstadoInstalacao {
  if (contarMigracoesAplicadas(banco) < migracoesDisponiveis) {
    return 'migracoes-pendentes';
  }
  if (!buscarBoardPadrao(banco)) {
    return 'board-ausente';
  }
  if (!existeAdministrador(banco)) {
    return 'configuracao-pendente';
  }
  return 'pronta';
}
