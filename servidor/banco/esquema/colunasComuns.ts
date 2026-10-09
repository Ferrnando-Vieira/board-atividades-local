import { sql, type SQL } from 'drizzle-orm';
import { integer, text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { PRIORIDADE } from '@/config/constantes';
import { agoraIso } from '@/util/DataUtils';

const AGORA_ISO_SQLITE = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;
const FORMATO_LITERAL_SEGURO = /^[a-z0-9:_-]+$/;

export const colunaId = () => integer('id').primaryKey({ autoIncrement: true });

export const colunaVersao = () => integer('versao').notNull().default(1);

export const colunaCriadoEm = () =>
  text('criado_em').notNull().default(AGORA_ISO_SQLITE);

export const colunaAtualizadoEm = () =>
  text('atualizado_em').notNull().default(AGORA_ISO_SQLITE).$onUpdate(agoraIso);

// Valores em CHECK precisam ir como literais: parâmetros ligados (?) não são
// aceitos em DDL.
export function literalNumerico(valor: number): SQL {
  if (!Number.isInteger(valor)) {
    throw new Error(`Literal numérico inválido para DDL: ${valor}`);
  }
  return sql.raw(String(valor));
}

export function listaLiteraisTexto(valores: readonly string[]): SQL {
  const invalido = valores.find((valor) => !FORMATO_LITERAL_SEGURO.test(valor));
  if (invalido !== undefined) {
    throw new Error(`Literal de texto inválido para DDL: ${invalido}`);
  }
  return sql.raw(valores.map((valor) => `'${valor}'`).join(', '));
}

export function textoPreenchido(coluna: AnySQLiteColumn): SQL {
  return sql`length(trim(${coluna})) > 0`;
}

export function textoComTamanho(
  coluna: AnySQLiteColumn,
  tamanhoMaximo: number,
): SQL {
  return sql`length(trim(${coluna})) > 0 AND length(${coluna}) <= ${literalNumerico(tamanhoMaximo)}`;
}

export function booleano(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} IN (0, 1)`;
}

export function hashSha256Hex(coluna: AnySQLiteColumn): SQL {
  return sql`length(${coluna}) = 64 AND ${coluna} NOT GLOB '*[^0-9a-f]*'`;
}

// GLOB diferencia maiúsculas: só "#rrggbb" em minúsculas passa.
export function corHexadecimal(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'`;
}

export function corHexadecimalOuNula(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} IS NULL OR ${corHexadecimal(coluna)}`;
}

export function instanteIsoUtc(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]T[0-2][0-9]:[0-5][0-9]:[0-5][0-9]*Z'`;
}

export function instanteIsoUtcOuNulo(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} IS NULL OR ${instanteIsoUtc(coluna)}`;
}

export function dataIsoOuNula(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} IS NULL OR (${coluna} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]' AND date(${coluna}) = ${coluna})`;
}

export function horaIsoOuNula(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} IS NULL OR (${coluna} GLOB '[0-2][0-9]:[0-5][0-9]' AND ${coluna} <= '23:59')`;
}

export function prioridadeNoIntervalo(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} BETWEEN ${literalNumerico(PRIORIDADE.MAIS_ALTA)} AND ${literalNumerico(PRIORIDADE.MAIS_BAIXA)}`;
}

export function prioridadeNoIntervaloOuNula(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} IS NULL OR (${prioridadeNoIntervalo(coluna)})`;
}
