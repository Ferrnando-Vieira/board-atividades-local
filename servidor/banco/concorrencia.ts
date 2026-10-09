import type Database from 'better-sqlite3';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { listasIguais } from '@/util/ListaUtils';

export const CODIGO_CONFLITO_VERSAO = 'conflito-de-versao';
export const CODIGO_CONFLITO_ORDEM = 'conflito-de-ordem';

// Atualizações de entidades editáveis filtram por `versao = versaoEsperada` e
// incrementam a versão; nenhuma linha alterada significa que outra operação
// gravou antes, e a alteração é recusada em vez de sobrescrever.
export function exigirAtualizacaoComVersao(
  resultado: Database.RunResult,
  descricaoEntidade: string,
): void {
  if (resultado.changes !== 1) {
    throw new ErroApp(
      `${descricaoEntidade} foi alterado por outra operação. Recarregue e tente novamente.`,
      { status: STATUS_ERRO.CONFLITO, codigo: CODIGO_CONFLITO_VERSAO },
    );
  }
}

// Usada dentro de transação IMMEDIATE: o bloqueio de escrita já foi obtido,
// então ler a versão e gravar em seguida não abre espaço para outro escritor.
export function exigirVersaoEsperada(
  versaoAtual: number,
  versaoEsperada: number,
  mensagem: string,
): void {
  if (versaoAtual !== versaoEsperada) {
    throw new ErroApp(mensagem, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGO_CONFLITO_VERSAO,
    });
  }
}

// A ordem que o cliente viu precisa ser a ordem gravada: se outra operação
// reordenou no meio tempo, aplicar a lista do cliente desfaria aquela mudança.
export function exigirOrdemEsperada(
  ordemAtual: readonly number[],
  ordemEsperada: readonly number[],
  mensagem: string,
): void {
  if (!listasIguais(ordemAtual, ordemEsperada)) {
    throw new ErroApp(mensagem, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGO_CONFLITO_ORDEM,
    });
  }
}
