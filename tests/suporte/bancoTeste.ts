import {
  abrirBanco,
  BANCO_EM_MEMORIA,
  type BancoDados,
} from '@/servidor/banco/conexao';
import { aplicarMigracoes } from '@/servidor/banco/migrador';
import { garantirBoardPadrao } from '@/servidor/board/boardRepositorio';
import { definirSolicitantePadrao } from '@/servidor/classificacao/classificacaoRepositorio';

// Nome fictício: em produção o padrão é informado na configuração inicial.
export const SOLICITANTE_PADRAO_TESTE = 'Ana Exemplo';

export function criarBancoMigrado(): BancoDados {
  const banco = abrirBanco(BANCO_EM_MEMORIA);
  aplicarMigracoes(banco);
  return banco;
}

// Board pronto para uso, como depois da configuração inicial: com o
// solicitante padrão definido.
export function criarBancoInicializado(): BancoDados {
  const banco = criarBancoMigrado();
  const { boardId } = garantirBoardPadrao(banco);
  definirSolicitantePadrao(banco, boardId, SOLICITANTE_PADRAO_TESTE);
  return banco;
}

export function contarLinhas(banco: BancoDados, tabela: string): number {
  const resultado = banco.$client
    .prepare(`SELECT count(*) AS quantidade FROM "${tabela}"`)
    .get() as { quantidade: number };
  return resultado.quantidade;
}
