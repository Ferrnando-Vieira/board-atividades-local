import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import fs from 'node:fs';
import path from 'node:path';
import * as esquema from '@/servidor/banco/esquema';

export const BANCO_EM_MEMORIA = ':memory:';
const TEMPO_ESPERA_BLOQUEIO_MS = 5000;

export type EsquemaBanco = typeof esquema;

export type BancoDados = ReturnType<typeof criarDrizzle>;

// Aceito por funções que podem rodar tanto no banco quanto dentro de uma
// transação já aberta pelo chamador.
export type ExecutorBanco = BaseSQLiteDatabase<
  'sync',
  Database.RunResult,
  EsquemaBanco
>;

function criarDrizzle(cliente: Database.Database) {
  return drizzle({ client: cliente, schema: esquema });
}

// WAL permite leitura simultânea enquanto um processo (servidor ou script)
// escreve; busy_timeout faz o segundo escritor esperar em vez de falhar.
function aplicarPragmas(cliente: Database.Database, emMemoria: boolean) {
  cliente.pragma('foreign_keys = ON');
  cliente.pragma(`busy_timeout = ${TEMPO_ESPERA_BLOQUEIO_MS}`);
  if (!emMemoria) {
    cliente.pragma('journal_mode = WAL');
  }
  cliente.pragma('synchronous = NORMAL');
}

type OpcoesAbertura = {
  exigirArquivoExistente?: boolean;
};

export function abrirBanco(
  caminho: string,
  opcoes: OpcoesAbertura = {},
): BancoDados {
  const emMemoria = caminho === BANCO_EM_MEMORIA;
  if (!emMemoria && !opcoes.exigirArquivoExistente) {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
  }
  const cliente = new Database(caminho, {
    fileMustExist: opcoes.exigirArquivoExistente ?? false,
  });
  aplicarPragmas(cliente, emMemoria);
  return criarDrizzle(cliente);
}

export function fecharBanco(banco: BancoDados): void {
  banco.$client.close();
}
