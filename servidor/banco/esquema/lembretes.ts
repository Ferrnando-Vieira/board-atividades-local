import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { LIMITES_TEXTO, SITUACOES_LEMBRETE } from '@/config/constantes';
import { boards } from './board';
import {
  colunaAtualizadoEm,
  colunaCriadoEm,
  colunaId,
  colunaVersao,
  instanteIsoUtc,
  instanteIsoUtcOuNulo,
  listaLiteraisTexto,
  literalNumerico,
  textoComTamanho,
} from './colunasComuns';

// Lembretes que não pertencem a nenhuma atividade ("ligar para o fornecedor
// às 15h"). Seguem as mesmas regras dos lembretes de atividade: instante
// absoluto em UTC, disparo único e dispensa registrada.
export const lembretesAvulsos = sqliteTable(
  'lembretes_avulsos',
  {
    id: colunaId(),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'restrict' }),
    titulo: text('titulo').notNull(),
    observacao: text('observacao'),
    lembreteEm: text('lembrete_em').notNull(),
    situacao: text('situacao', { enum: SITUACOES_LEMBRETE })
      .notNull()
      .default('pendente'),
    disparadoEm: text('disparado_em'),
    dispensadoEm: text('dispensado_em'),
    versao: colunaVersao(),
    criadoEm: colunaCriadoEm(),
    atualizadoEm: colunaAtualizadoEm(),
  },
  (tabela) => [
    index('lembretes_avulsos_pendentes')
      .on(tabela.lembreteEm)
      .where(sql`${tabela.situacao} = 'pendente'`),
    index('lembretes_avulsos_a_dispensar')
      .on(tabela.disparadoEm)
      .where(
        sql`${tabela.situacao} = 'disparado' AND ${tabela.dispensadoEm} IS NULL`,
      ),
    check(
      'lembretes_avulsos_titulo_valido',
      textoComTamanho(tabela.titulo, LIMITES_TEXTO.TITULO_LEMBRETE),
    ),
    check(
      'lembretes_avulsos_observacao_tamanho',
      sql`${tabela.observacao} IS NULL OR length(${tabela.observacao}) <= ${literalNumerico(LIMITES_TEXTO.OBSERVACAO_LEMBRETE)}`,
    ),
    check(
      'lembretes_avulsos_lembrete_em_formato',
      instanteIsoUtc(tabela.lembreteEm),
    ),
    check(
      'lembretes_avulsos_situacao_valida',
      sql`${tabela.situacao} IN (${listaLiteraisTexto(SITUACOES_LEMBRETE)})`,
    ),
    check(
      'lembretes_avulsos_disparo_coerente',
      sql`${tabela.disparadoEm} IS NULL OR ${tabela.situacao} = 'disparado'`,
    ),
    check(
      'lembretes_avulsos_disparado_em_formato',
      instanteIsoUtcOuNulo(tabela.disparadoEm),
    ),
    check(
      'lembretes_avulsos_dispensado_em_formato',
      instanteIsoUtcOuNulo(tabela.dispensadoEm),
    ),
    check(
      'lembretes_avulsos_dispensa_coerente',
      sql`${tabela.dispensadoEm} IS NULL OR (${tabela.situacao} = 'disparado' AND ${tabela.disparadoEm} IS NOT NULL)`,
    ),
    check('lembretes_avulsos_versao_positiva', sql`${tabela.versao} >= 1`),
  ],
);
