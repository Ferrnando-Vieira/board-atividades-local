import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { BancoDados } from '@/servidor/banco/conexao';

export const DIRETORIO_MIGRACOES = path.join(
  process.cwd(),
  'servidor',
  'banco',
  'migracoes',
);

const TABELA_CONTROLE_MIGRACOES = '__drizzle_migrations';
const CAMINHO_RELATIVO_JORNAL = path.join('meta', '_journal.json');

const esquemaJornal = z.object({
  entries: z.array(z.object({ tag: z.string() })),
});

// O migrador do Drizzle aplica todas as migrações pendentes numa única
// transação e registra cada uma em __drizzle_migrations; repetir é inócuo.
export function aplicarMigracoes(
  banco: BancoDados,
  diretorio: string = DIRETORIO_MIGRACOES,
): void {
  migrate(banco, { migrationsFolder: diretorio });
}

export function contarMigracoesDisponiveis(
  diretorio: string = DIRETORIO_MIGRACOES,
): number {
  const conteudo = fs.readFileSync(
    path.join(diretorio, CAMINHO_RELATIVO_JORNAL),
    'utf8',
  );
  return esquemaJornal.parse(JSON.parse(conteudo)).entries.length;
}

export function contarMigracoesAplicadas(banco: BancoDados): number {
  const tabela = banco.get<{ quantidade: number }>(
    sql`SELECT count(*) AS quantidade FROM sqlite_master WHERE type = 'table' AND name = ${TABELA_CONTROLE_MIGRACOES}`,
  );
  if (!tabela || tabela.quantidade === 0) {
    return 0;
  }
  const aplicadas = banco.get<{ quantidade: number }>(
    sql`SELECT count(*) AS quantidade FROM ${sql.identifier(TABELA_CONTROLE_MIGRACOES)}`,
  );
  return aplicadas?.quantidade ?? 0;
}
