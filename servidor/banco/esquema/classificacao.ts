import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { LIMITES_TEXTO } from '@/config/constantes';
import { boards } from './board';
import {
  booleano,
  colunaAtualizadoEm,
  colunaCriadoEm,
  colunaId,
  corHexadecimalOuNula,
  textoComTamanho,
  textoPreenchido,
} from './colunasComuns';

export const solicitantes = sqliteTable(
  'solicitantes',
  {
    id: colunaId(),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'restrict' }),
    nome: text('nome').notNull(),
    nomeNormalizado: text('nome_normalizado').notNull(),
    // Solicitante usado quando uma atividade é gravada sem informar outro.
    // Definido na configuração inicial e alterável depois em Solicitantes.
    padrao: integer('padrao', { mode: 'boolean' }).notNull().default(false),
    criadoEm: colunaCriadoEm(),
    atualizadoEm: colunaAtualizadoEm(),
  },
  (tabela) => [
    uniqueIndex('solicitantes_nome_normalizado_unico').on(
      tabela.boardId,
      tabela.nomeNormalizado,
    ),
    // No máximo um solicitante padrão por board.
    uniqueIndex('solicitantes_padrao_unico')
      .on(tabela.boardId)
      .where(sql`${tabela.padrao} = 1`),
    check('solicitantes_padrao_booleano', booleano(tabela.padrao)),
    check(
      'solicitantes_nome_valido',
      textoComTamanho(tabela.nome, LIMITES_TEXTO.NOME_SOLICITANTE),
    ),
    check(
      'solicitantes_nome_normalizado_preenchido',
      textoPreenchido(tabela.nomeNormalizado),
    ),
  ],
);

export const tags = sqliteTable(
  'tags',
  {
    id: colunaId(),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'restrict' }),
    nome: text('nome').notNull(),
    nomeNormalizado: text('nome_normalizado').notNull(),
    // Nula = chip neutro do tema.
    cor: text('cor'),
    // Solicitante gravado numa atividade salva sem solicitante que tenha esta
    // tag; entre as tags da atividade, vale a vinculada primeiro. Nulo = a
    // tag não define solicitante.
    solicitantePadraoId: integer('solicitante_padrao_id').references(
      () => solicitantes.id,
      { onDelete: 'set null' },
    ),
    criadoEm: colunaCriadoEm(),
    atualizadoEm: colunaAtualizadoEm(),
  },
  (tabela) => [
    uniqueIndex('tags_nome_normalizado_unico').on(
      tabela.boardId,
      tabela.nomeNormalizado,
    ),
    check(
      'tags_nome_valido',
      textoComTamanho(tabela.nome, LIMITES_TEXTO.NOME_TAG),
    ),
    check(
      'tags_nome_normalizado_preenchido',
      textoPreenchido(tabela.nomeNormalizado),
    ),
    check('tags_cor_formato', corHexadecimalOuNula(tabela.cor)),
  ],
);
