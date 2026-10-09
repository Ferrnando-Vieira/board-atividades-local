import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { USUARIO_ADMINISTRADOR } from '@/config/constantesSeguranca';
import {
  colunaAtualizadoEm,
  colunaCriadoEm,
  colunaId,
  hashSha256Hex,
  instanteIsoUtcOuNulo,
  literalNumerico,
} from './colunasComuns';

export const ID_REGISTRO_UNICO = 1;

// O CHECK id = 1 torna a tabela um registro único: duas configurações
// iniciais concorrentes não conseguem criar dois administradores.
export const administrador = sqliteTable(
  'administrador',
  {
    id: integer('id').primaryKey(),
    usuario: text('usuario').notNull(),
    hashSenha: text('hash_senha').notNull(),
    tentativasFalhas: integer('tentativas_falhas').notNull().default(0),
    bloqueadoAte: text('bloqueado_ate'),
    senhaAlteradaEm: text('senha_alterada_em').notNull(),
    criadoEm: colunaCriadoEm(),
    atualizadoEm: colunaAtualizadoEm(),
  },
  (tabela) => [
    check(
      'administrador_registro_unico',
      sql`${tabela.id} = ${literalNumerico(ID_REGISTRO_UNICO)}`,
    ),
    check(
      'administrador_usuario_valido',
      sql`length(${tabela.usuario}) BETWEEN ${literalNumerico(USUARIO_ADMINISTRADOR.TAMANHO_MINIMO)} AND ${literalNumerico(USUARIO_ADMINISTRADOR.TAMANHO_MAXIMO)} AND ${tabela.usuario} NOT GLOB '*[^a-z0-9._-]*'`,
    ),
    check(
      'administrador_hash_senha_formato',
      sql`${tabela.hashSenha} GLOB 'scrypt$*'`,
    ),
    check(
      'administrador_tentativas_nao_negativas',
      sql`${tabela.tentativasFalhas} >= 0`,
    ),
    check(
      'administrador_bloqueado_ate_formato',
      instanteIsoUtcOuNulo(tabela.bloqueadoAte),
    ),
  ],
);

// Guarda só o hash do código exibido no terminal por `npm run inicializar`;
// sem ele, ninguém na rede consegue concluir a configuração inicial.
export const codigoConfiguracaoInicial = sqliteTable(
  'codigo_configuracao_inicial',
  {
    id: integer('id').primaryKey(),
    hashCodigo: text('hash_codigo').notNull(),
    expiraEm: text('expira_em').notNull(),
    tentativasFalhas: integer('tentativas_falhas').notNull().default(0),
    criadoEm: colunaCriadoEm(),
  },
  (tabela) => [
    check(
      'codigo_configuracao_registro_unico',
      sql`${tabela.id} = ${literalNumerico(ID_REGISTRO_UNICO)}`,
    ),
    check('codigo_configuracao_hash_formato', hashSha256Hex(tabela.hashCodigo)),
    check(
      'codigo_configuracao_expira_em_formato',
      instanteIsoUtcOuNulo(tabela.expiraEm),
    ),
    check(
      'codigo_configuracao_tentativas_nao_negativas',
      sql`${tabela.tentativasFalhas} >= 0`,
    ),
  ],
);

export const sessoesAdministrativas = sqliteTable(
  'sessoes_administrativas',
  {
    id: colunaId(),
    administradorId: integer('administrador_id')
      .notNull()
      .references(() => administrador.id, { onDelete: 'cascade' }),
    hashToken: text('hash_token').notNull(),
    expiraEm: text('expira_em').notNull(),
    ultimoUsoEm: text('ultimo_uso_em').notNull(),
    revogadaEm: text('revogada_em'),
    criadoEm: colunaCriadoEm(),
  },
  (tabela) => [
    uniqueIndex('sessoes_administrativas_hash_token_unico').on(
      tabela.hashToken,
    ),
    index('sessoes_administrativas_expira_em').on(tabela.expiraEm),
    check(
      'sessoes_administrativas_hash_formato',
      hashSha256Hex(tabela.hashToken),
    ),
    check(
      'sessoes_administrativas_expira_em_formato',
      instanteIsoUtcOuNulo(tabela.expiraEm),
    ),
    check(
      'sessoes_administrativas_ultimo_uso_em_formato',
      instanteIsoUtcOuNulo(tabela.ultimoUsoEm),
    ),
    check(
      'sessoes_administrativas_revogada_em_formato',
      instanteIsoUtcOuNulo(tabela.revogadaEm),
    ),
  ],
);
