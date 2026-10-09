import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import {
  LIMITES_TEXTO,
  ORIGENS_ALTERACAO,
  TIPOS_EVENTO_HISTORICO,
} from '@/config/constantes';
import { atividades } from './atividades';
import {
  colunaId,
  instanteIsoUtc,
  listaLiteraisTexto,
  literalNumerico,
} from './colunasComuns';

// Um registro por operação que mudou a atividade. `alteracoes` é uma lista
// JSON de { campo, antes, depois } com os valores como eram exibidos naquele
// momento (nome do status, do solicitante, das tags), para que renomear um
// status depois não reescreva o passado. `autor` é o usuário administrador,
// o nome do link ou o nome do token; nulo quando a origem é um script.
export const historicoAtividades = sqliteTable(
  'historico_atividades',
  {
    id: colunaId(),
    atividadeId: integer('atividade_id')
      .notNull()
      .references(() => atividades.id, { onDelete: 'cascade' }),
    tipo: text('tipo', { enum: TIPOS_EVENTO_HISTORICO }).notNull(),
    origem: text('origem', { enum: ORIGENS_ALTERACAO }).notNull(),
    autor: text('autor'),
    alteracoes: text('alteracoes').notNull().default('[]'),
    ocorridoEm: text('ocorrido_em').notNull(),
  },
  (tabela) => [
    index('historico_atividades_atividade').on(
      tabela.atividadeId,
      tabela.ocorridoEm,
    ),
    check(
      'historico_atividades_tipo_valido',
      sql`${tabela.tipo} IN (${listaLiteraisTexto(TIPOS_EVENTO_HISTORICO)})`,
    ),
    check(
      'historico_atividades_origem_valida',
      sql`${tabela.origem} IN (${listaLiteraisTexto(ORIGENS_ALTERACAO)})`,
    ),
    check(
      'historico_atividades_autor_tamanho',
      sql`${tabela.autor} IS NULL OR (length(trim(${tabela.autor})) > 0 AND length(${tabela.autor}) <= ${literalNumerico(LIMITES_TEXTO.AUTOR_HISTORICO)})`,
    ),
    check(
      'historico_atividades_alteracoes_lista',
      sql`json_valid(${tabela.alteracoes}) AND json_type(${tabela.alteracoes}) = 'array'`,
    ),
    check(
      'historico_atividades_ocorrido_em_formato',
      instanteIsoUtc(tabela.ocorridoEm),
    ),
  ],
);
