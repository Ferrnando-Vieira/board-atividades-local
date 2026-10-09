import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { LIMITES_TEXTO, PERMISSOES_API } from '@/config/constantes';
import {
  colunaAtualizadoEm,
  colunaCriadoEm,
  colunaId,
  hashSha256Hex,
  instanteIsoUtcOuNulo,
  listaLiteraisTexto,
  textoComTamanho,
} from './colunasComuns';

// `prefixo` é um trecho público do token, só para o administrador reconhecer
// qual token é qual; o valor completo existe apenas no momento da criação.
export const tokensApi = sqliteTable(
  'tokens_api',
  {
    id: colunaId(),
    nome: text('nome').notNull(),
    prefixo: text('prefixo').notNull(),
    hashToken: text('hash_token').notNull(),
    expiraEm: text('expira_em'),
    revogadoEm: text('revogado_em'),
    ultimoUsoEm: text('ultimo_uso_em'),
    criadoEm: colunaCriadoEm(),
    atualizadoEm: colunaAtualizadoEm(),
  },
  (tabela) => [
    uniqueIndex('tokens_api_hash_token_unico').on(tabela.hashToken),
    check(
      'tokens_api_nome_valido',
      textoComTamanho(tabela.nome, LIMITES_TEXTO.NOME_TOKEN_API),
    ),
    check(
      'tokens_api_prefixo_formato',
      sql`length(${tabela.prefixo}) BETWEEN 4 AND 16`,
    ),
    check('tokens_api_hash_formato', hashSha256Hex(tabela.hashToken)),
    check(
      'tokens_api_expira_em_formato',
      instanteIsoUtcOuNulo(tabela.expiraEm),
    ),
    check(
      'tokens_api_revogado_em_formato',
      instanteIsoUtcOuNulo(tabela.revogadoEm),
    ),
  ],
);

export const tokensApiPermissoes = sqliteTable(
  'tokens_api_permissoes',
  {
    tokenId: integer('token_id')
      .notNull()
      .references(() => tokensApi.id, { onDelete: 'cascade' }),
    permissao: text('permissao', { enum: PERMISSOES_API }).notNull(),
  },
  (tabela) => [
    primaryKey({ columns: [tabela.tokenId, tabela.permissao] }),
    check(
      'tokens_api_permissoes_catalogo',
      sql`${tabela.permissao} IN (${listaLiteraisTexto(PERMISSOES_API)})`,
    ),
  ],
);
