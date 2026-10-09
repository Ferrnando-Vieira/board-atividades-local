import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import {
  LIMITES_TEXTO,
  MODALIDADES_COMPARTILHAMENTO,
} from '@/config/constantes';
import {
  boards,
  colunasAparencia,
  restricoesAparencia,
  statusBoard,
} from './board';
import { solicitantes, tags } from './classificacao';
import {
  booleano,
  colunaAtualizadoEm,
  colunaCriadoEm,
  colunaId,
  colunaVersao,
  hashSha256Hex,
  instanteIsoUtcOuNulo,
  listaLiteraisTexto,
  prioridadeNoIntervaloOuNula,
  textoComTamanho,
} from './colunasComuns';

// Semântica do escopo: valores de uma mesma dimensão combinam com OU, e
// dimensões diferentes combinam com E; dimensão sem linhas não restringe.
// Por isso status, tags e solicitantes referenciados usam RESTRICT: apagar
// um deles não pode ampliar silenciosamente o que o link expõe.
// O CHECK de `modalidade` chegou na migração 0001 como restrição de coluna
// (ADD COLUMN): recriar a tabela apagaria em cascata o escopo dos links, já
// que o migrador roda numa transação com chaves estrangeiras ativas.
export const linksCompartilhamento = sqliteTable(
  'links_compartilhamento',
  {
    id: colunaId(),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'restrict' }),
    nome: text('nome').notNull(),
    modalidade: text('modalidade', { enum: MODALIDADES_COMPARTILHAMENTO })
      .notNull()
      .default('restrito'),
    hashToken: text('hash_token').notNull(),
    incluirArquivadas: integer('incluir_arquivadas', { mode: 'boolean' })
      .notNull()
      .default(false),
    prioridadeMinima: integer('prioridade_minima'),
    prioridadeMaxima: integer('prioridade_maxima'),
    expiraEm: text('expira_em'),
    revogadoEm: text('revogado_em'),
    ultimoAcessoEm: text('ultimo_acesso_em'),
    padrao: integer('padrao', { mode: 'boolean' }).notNull().default(false),
    // Animal fixo de quem entra pelo link (chave de config/animais); nulo =
    // sorteado. Sem CHECK de lista: a aplicação valida, e uma chave que saia
    // do catálogo só volta a ser sorteada, sem migração.
    animal: text('animal'),
    versao: colunaVersao(),
    criadoEm: colunaCriadoEm(),
    atualizadoEm: colunaAtualizadoEm(),
  },
  (tabela) => [
    uniqueIndex('links_compartilhamento_hash_token_unico').on(tabela.hashToken),
    // No máximo um link padrão ativo por board; revogado, ele sai do índice e
    // um novo pode ser gerado.
    uniqueIndex('links_compartilhamento_padrao_ativo_unico')
      .on(tabela.boardId)
      .where(sql`${tabela.padrao} = 1 AND ${tabela.revogadoEm} IS NULL`),
    check('links_compartilhamento_padrao_booleano', booleano(tabela.padrao)),
    // O link padrão é sempre o board inteiro em somente leitura: modalidade
    // restrita, sem arquivadas e sem expiração. Nem um erro de código consegue
    // gravar um link padrão que edite.
    check(
      'links_compartilhamento_padrao_somente_leitura',
      sql`${tabela.padrao} = 0 OR (${tabela.modalidade} = 'restrito' AND ${tabela.incluirArquivadas} = 0 AND ${tabela.expiraEm} IS NULL)`,
    ),
    check(
      'links_compartilhamento_nome_valido',
      textoComTamanho(tabela.nome, LIMITES_TEXTO.NOME_LINK_COMPARTILHAMENTO),
    ),
    check(
      'links_compartilhamento_modalidade_valida',
      sql`${tabela.modalidade} IN (${listaLiteraisTexto(MODALIDADES_COMPARTILHAMENTO)})`,
    ),
    check(
      'links_compartilhamento_hash_formato',
      hashSha256Hex(tabela.hashToken),
    ),
    check(
      'links_compartilhamento_incluir_arquivadas_booleano',
      booleano(tabela.incluirArquivadas),
    ),
    check(
      'links_compartilhamento_prioridade_minima_intervalo',
      prioridadeNoIntervaloOuNula(tabela.prioridadeMinima),
    ),
    check(
      'links_compartilhamento_prioridade_maxima_intervalo',
      prioridadeNoIntervaloOuNula(tabela.prioridadeMaxima),
    ),
    check(
      'links_compartilhamento_faixa_prioridade_coerente',
      sql`${tabela.prioridadeMinima} IS NULL OR ${tabela.prioridadeMaxima} IS NULL OR ${tabela.prioridadeMinima} <= ${tabela.prioridadeMaxima}`,
    ),
    check(
      'links_compartilhamento_expira_em_formato',
      instanteIsoUtcOuNulo(tabela.expiraEm),
    ),
    check(
      'links_compartilhamento_revogado_em_formato',
      instanteIsoUtcOuNulo(tabela.revogadoEm),
    ),
    check('links_compartilhamento_versao_positiva', sql`${tabela.versao} >= 1`),
  ],
);

export const escopoLinkStatus = sqliteTable(
  'escopo_link_status',
  {
    linkId: integer('link_id')
      .notNull()
      .references(() => linksCompartilhamento.id, { onDelete: 'cascade' }),
    statusId: integer('status_id')
      .notNull()
      .references(() => statusBoard.id, { onDelete: 'restrict' }),
  },
  (tabela) => [primaryKey({ columns: [tabela.linkId, tabela.statusId] })],
);

export const escopoLinkTags = sqliteTable(
  'escopo_link_tags',
  {
    linkId: integer('link_id')
      .notNull()
      .references(() => linksCompartilhamento.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'restrict' }),
  },
  (tabela) => [primaryKey({ columns: [tabela.linkId, tabela.tagId] })],
);

export const escopoLinkSolicitantes = sqliteTable(
  'escopo_link_solicitantes',
  {
    linkId: integer('link_id')
      .notNull()
      .references(() => linksCompartilhamento.id, { onDelete: 'cascade' }),
    solicitanteId: integer('solicitante_id')
      .notNull()
      .references(() => solicitantes.id, { onDelete: 'restrict' }),
  },
  (tabela) => [primaryKey({ columns: [tabela.linkId, tabela.solicitanteId] })],
);

// Aparência própria de um link nomeado (completo ou restrito), que vale só
// para quem entra por ele. Sem linha, o link mostra a aparência do board; a
// primeira alteração copia a do board e aplica a mudança por cima. O link
// padrão (público) não personaliza. Revogar o link mantém a linha, que deixa
// de ser lida; uma imagem de fundo só é apagada quando nenhuma linha (do
// board ou de outro link) a usa.
export const aparenciasLink = sqliteTable(
  'aparencias_link',
  {
    linkId: integer('link_id')
      .primaryKey()
      .references(() => linksCompartilhamento.id, { onDelete: 'cascade' }),
    ...colunasAparencia(),
  },
  (tabela) => restricoesAparencia('aparencias_link', tabela),
);
