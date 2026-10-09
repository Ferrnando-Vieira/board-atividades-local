import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import {
  LIMITES_TEXTO,
  PRIORIDADE,
  SITUACOES_LEMBRETE,
} from '@/config/constantes';
import { boards, statusBoard } from './board';
import { solicitantes, tags } from './classificacao';
import {
  colunaAtualizadoEm,
  colunaCriadoEm,
  colunaId,
  colunaVersao,
  dataIsoOuNula,
  horaIsoOuNula,
  instanteIsoUtcOuNulo,
  listaLiteraisTexto,
  literalNumerico,
  prioridadeNoIntervalo,
  textoComTamanho,
} from './colunasComuns';

// Prazo e conclusão guardam data e hora locais (fuso do board) separadas,
// porque a hora é opcional; o lembrete é um instante absoluto em UTC para
// que o disparo não dependa de fuso.
export const atividades = sqliteTable(
  'atividades',
  {
    id: colunaId(),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'restrict' }),
    statusId: integer('status_id')
      .notNull()
      .references(() => statusBoard.id, { onDelete: 'restrict' }),
    solicitanteId: integer('solicitante_id')
      .notNull()
      .references(() => solicitantes.id, { onDelete: 'restrict' }),
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    prioridade: integer('prioridade').notNull().default(PRIORIDADE.PADRAO),
    ordem: integer('ordem').notNull(),
    arquivadaEm: text('arquivada_em'),
    prazoData: text('prazo_data'),
    prazoHora: text('prazo_hora'),
    concluidaEmData: text('concluida_em_data'),
    concluidaEmHora: text('concluida_em_hora'),
    lembreteEm: text('lembrete_em'),
    lembreteSituacao: text('lembrete_situacao', { enum: SITUACOES_LEMBRETE }),
    lembreteDisparadoEm: text('lembrete_disparado_em'),
    lembreteDispensadoEm: text('lembrete_dispensado_em'),
    versao: colunaVersao(),
    criadoEm: colunaCriadoEm(),
    atualizadoEm: colunaAtualizadoEm(),
  },
  (tabela) => [
    index('atividades_board_status').on(tabela.boardId, tabela.statusId),
    uniqueIndex('atividades_ordem_ativa_unica')
      .on(tabela.statusId, tabela.ordem)
      .where(sql`${tabela.arquivadaEm} IS NULL`),
    index('atividades_lembretes_pendentes')
      .on(tabela.lembreteEm)
      .where(sql`${tabela.lembreteSituacao} = 'pendente'`),
    index('atividades_lembretes_a_dispensar')
      .on(tabela.lembreteDisparadoEm)
      .where(
        sql`${tabela.lembreteSituacao} = 'disparado' AND ${tabela.lembreteDispensadoEm} IS NULL`,
      ),
    check(
      'atividades_titulo_valido',
      textoComTamanho(tabela.titulo, LIMITES_TEXTO.TITULO_ATIVIDADE),
    ),
    check(
      'atividades_descricao_tamanho',
      sql`${tabela.descricao} IS NULL OR length(${tabela.descricao}) <= ${literalNumerico(LIMITES_TEXTO.DESCRICAO_ATIVIDADE)}`,
    ),
    check(
      'atividades_prioridade_intervalo',
      prioridadeNoIntervalo(tabela.prioridade),
    ),
    check('atividades_ordem_nao_negativa', sql`${tabela.ordem} >= 0`),
    check(
      'atividades_arquivada_em_formato',
      instanteIsoUtcOuNulo(tabela.arquivadaEm),
    ),
    check('atividades_prazo_data_formato', dataIsoOuNula(tabela.prazoData)),
    check('atividades_prazo_hora_formato', horaIsoOuNula(tabela.prazoHora)),
    check(
      'atividades_prazo_hora_exige_data',
      sql`${tabela.prazoHora} IS NULL OR ${tabela.prazoData} IS NOT NULL`,
    ),
    check(
      'atividades_conclusao_data_formato',
      dataIsoOuNula(tabela.concluidaEmData),
    ),
    check(
      'atividades_conclusao_hora_formato',
      horaIsoOuNula(tabela.concluidaEmHora),
    ),
    check(
      'atividades_conclusao_hora_exige_data',
      sql`${tabela.concluidaEmHora} IS NULL OR ${tabela.concluidaEmData} IS NOT NULL`,
    ),
    check(
      'atividades_lembrete_em_formato',
      instanteIsoUtcOuNulo(tabela.lembreteEm),
    ),
    check(
      'atividades_lembrete_situacao_valida',
      sql`${tabela.lembreteSituacao} IS NULL OR ${tabela.lembreteSituacao} IN (${listaLiteraisTexto(SITUACOES_LEMBRETE)})`,
    ),
    check(
      'atividades_lembrete_completo',
      sql`(${tabela.lembreteEm} IS NULL) = (${tabela.lembreteSituacao} IS NULL)`,
    ),
    check(
      'atividades_lembrete_disparo_coerente',
      sql`${tabela.lembreteDisparadoEm} IS NULL OR ${tabela.lembreteSituacao} = 'disparado'`,
    ),
    check(
      'atividades_lembrete_disparado_em_formato',
      instanteIsoUtcOuNulo(tabela.lembreteDisparadoEm),
    ),
    check(
      'atividades_lembrete_dispensado_em_formato',
      instanteIsoUtcOuNulo(tabela.lembreteDispensadoEm),
    ),
    // Só se dispensa o que foi disparado por este sistema: os lembretes
    // históricos gravados como 'disparado' não têm momento de disparo.
    check(
      'atividades_lembrete_dispensa_coerente',
      sql`${tabela.lembreteDispensadoEm} IS NULL OR (${tabela.lembreteSituacao} = 'disparado' AND ${tabela.lembreteDisparadoEm} IS NOT NULL)`,
    ),
    check('atividades_versao_positiva', sql`${tabela.versao} >= 1`),
  ],
);

export const atividadesTags = sqliteTable(
  'atividades_tags',
  {
    atividadeId: integer('atividade_id')
      .notNull()
      .references(() => atividades.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'restrict' }),
    criadoEm: colunaCriadoEm(),
  },
  (tabela) => [
    primaryKey({ columns: [tabela.atividadeId, tabela.tagId] }),
    index('atividades_tags_tag').on(tabela.tagId),
  ],
);
