import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { LIMITES_TEXTO } from '@/config/constantes';
import { atividades } from './atividades';
import {
  colunaCriadoEm,
  colunaId,
  hashSha256Hex,
  instanteIsoUtcOuNulo,
  textoComTamanho,
  textoPreenchido,
} from './colunasComuns';

// O arquivo fica no DIRETORIO_ANEXOS (fora de public/) com nome igual a
// identificador_arquivo; o nome original nunca é usado como caminho em disco.
export const anexos = sqliteTable(
  'anexos',
  {
    id: colunaId(),
    atividadeId: integer('atividade_id')
      .notNull()
      .references(() => atividades.id, { onDelete: 'restrict' }),
    identificadorArquivo: text('identificador_arquivo').notNull(),
    nomeOriginal: text('nome_original').notNull(),
    tipoConteudo: text('tipo_conteudo').notNull(),
    tamanhoBytes: integer('tamanho_bytes').notNull(),
    hashSha256: text('hash_sha256').notNull(),
    criadoEm: colunaCriadoEm(),
    removidoEm: text('removido_em'),
  },
  (tabela) => [
    uniqueIndex('anexos_identificador_arquivo_unico').on(
      tabela.identificadorArquivo,
    ),
    index('anexos_atividade').on(tabela.atividadeId),
    check(
      'anexos_identificador_formato',
      sql`length(${tabela.identificadorArquivo}) BETWEEN 16 AND 64 AND ${tabela.identificadorArquivo} NOT GLOB '*[^0-9a-zA-Z_-]*'`,
    ),
    check(
      'anexos_nome_original_valido',
      textoComTamanho(tabela.nomeOriginal, LIMITES_TEXTO.NOME_ARQUIVO_ANEXO),
    ),
    check(
      'anexos_tipo_conteudo_preenchido',
      textoPreenchido(tabela.tipoConteudo),
    ),
    check('anexos_tamanho_positivo', sql`${tabela.tamanhoBytes} > 0`),
    check('anexos_hash_formato', hashSha256Hex(tabela.hashSha256)),
    check(
      'anexos_removido_em_formato',
      instanteIsoUtcOuNulo(tabela.removidoEm),
    ),
  ],
);
