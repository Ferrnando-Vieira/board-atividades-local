import { sql, type SQL } from 'drizzle-orm';
import {
  check,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import {
  LIMITES_OPACIDADE,
  MODOS_TOM_TEXTO,
  SUPERFICIES_PADRAO,
} from '@/config/aparenciaBoard';
import { LIMITES_TEXTO } from '@/config/constantes';
import {
  CHAVES_FUNDO_BOARD,
  CHAVES_FUNDO_LEGADO,
  FORMATOS_GRADIENTE,
  FORMATOS_IMAGEM_FUNDO,
  FUNDO_BOARD_PADRAO,
  GRADIENTE_PERSONALIZADO_PADRAO,
  LIMITES_GRADIENTE,
  TIPOS_FUNDO_BOARD,
} from '@/config/fundosBoard';
import {
  booleano,
  colunaAtualizadoEm,
  colunaCriadoEm,
  colunaId,
  colunaVersao,
  corHexadecimal,
  corHexadecimalOuNula,
  hashSha256Hex,
  listaLiteraisTexto,
  literalNumerico,
  textoComTamanho,
  textoPreenchido,
} from './colunasComuns';

function opacidadeNoIntervalo(coluna: AnySQLiteColumn): SQL {
  return sql`${coluna} BETWEEN ${literalNumerico(LIMITES_OPACIDADE.MINIMA)} AND ${literalNumerico(LIMITES_OPACIDADE.MAXIMA)}`;
}

// `fundo` guarda só a chave de um item do catálogo de fundos: o CHECK recusa
// qualquer outro texto, então CSS ou URL nunca chegam a ser gravados. Desde a
// migração 0003 a coluna é legado (a escolha vive em `fundos_board`); o CHECK
// segue com a lista da 0002.
export const boards = sqliteTable(
  'boards',
  {
    id: colunaId(),
    chave: text('chave').notNull(),
    nome: text('nome').notNull(),
    fusoHorario: text('fuso_horario').notNull(),
    fundo: text('fundo', { enum: CHAVES_FUNDO_LEGADO })
      .notNull()
      .default(FUNDO_BOARD_PADRAO),
    versao: colunaVersao(),
    criadoEm: colunaCriadoEm(),
    atualizadoEm: colunaAtualizadoEm(),
  },
  (tabela) => [
    uniqueIndex('boards_chave_unica').on(tabela.chave),
    check('boards_chave_preenchida', textoPreenchido(tabela.chave)),
    check(
      'boards_nome_valido',
      textoComTamanho(tabela.nome, LIMITES_TEXTO.NOME_BOARD),
    ),
    check('boards_fuso_preenchido', textoPreenchido(tabela.fusoHorario)),
    check(
      'boards_fundo_valido',
      sql`${tabela.fundo} IN (${listaLiteraisTexto(CHAVES_FUNDO_LEGADO)})`,
    ),
    check('boards_versao_positiva', sql`${tabela.versao} >= 1`),
  ],
);

// Colunas de aparência (fundo, superfícies e cores de prioridade), comuns à
// aparência do board (`fundos_board`) e à aparência própria de cada link
// nomeado (`aparencias_link`). `tipo` escolhe o que vale; o gradiente
// personalizado fica guardado mesmo quando outro tipo está ativo, para
// reabrir o editor com a última escolha. Cores, ângulo, chave e formato da
// imagem só passam pelos CHECKs de `restricoesAparencia`: o CSS é montado no
// servidor a partir destes valores, nunca de texto livre.
export function colunasAparencia() {
  return {
    tipo: text('tipo', { enum: TIPOS_FUNDO_BOARD })
      .notNull()
      .default('predefinido'),
    chavePredefinida: text('chave_predefinida', { enum: CHAVES_FUNDO_BOARD })
      .notNull()
      .default(FUNDO_BOARD_PADRAO),
    gradienteFormato: text('gradiente_formato', { enum: FORMATOS_GRADIENTE })
      .notNull()
      .default(GRADIENTE_PERSONALIZADO_PADRAO.formato),
    gradienteAngulo: integer('gradiente_angulo')
      .notNull()
      .default(GRADIENTE_PERSONALIZADO_PADRAO.angulo),
    gradienteCorInicial: text('gradiente_cor_inicial')
      .notNull()
      .default(GRADIENTE_PERSONALIZADO_PADRAO.cores[0]),
    gradienteCorIntermediaria: text('gradiente_cor_intermediaria'),
    gradienteCorFinal: text('gradiente_cor_final')
      .notNull()
      .default(GRADIENTE_PERSONALIZADO_PADRAO.cores[1]),
    imagemIdentificador: text('imagem_identificador'),
    imagemFormato: text('imagem_formato', { enum: FORMATOS_IMAGEM_FUNDO }),
    imagemHash: text('imagem_hash'),
    imagemCorMedia: text('imagem_cor_media'),
    corTitulos: text('cor_titulos')
      .notNull()
      .default(SUPERFICIES_PADRAO.corTitulos),
    corColunas: text('cor_colunas')
      .notNull()
      .default(SUPERFICIES_PADRAO.corColunas),
    opacidadeTitulos: integer('opacidade_titulos')
      .notNull()
      .default(SUPERFICIES_PADRAO.opacidadeTitulos),
    opacidadeColunas: integer('opacidade_colunas')
      .notNull()
      .default(SUPERFICIES_PADRAO.opacidadeColunas),
    tomTexto: text('tom_texto', { enum: MODOS_TOM_TEXTO })
      .notNull()
      .default(SUPERFICIES_PADRAO.tomTexto),
    corPrioridadeCritica: text('cor_prioridade_critica'),
    corPrioridadeAlta: text('cor_prioridade_alta'),
    corPrioridadeMedia: text('cor_prioridade_media'),
    corPrioridadeBaixa: text('cor_prioridade_baixa'),
    atualizadoEm: colunaAtualizadoEm(),
  };
}

type TabelaAparencia = Record<
  keyof ReturnType<typeof colunasAparencia>,
  AnySQLiteColumn
>;

// `prefixo` dá nome às restrições de cada tabela (ex.: "fundos_board").
export function restricoesAparencia(prefixo: string, tabela: TabelaAparencia) {
  return [
    check(
      `${prefixo}_tipo_valido`,
      sql`${tabela.tipo} IN (${listaLiteraisTexto(TIPOS_FUNDO_BOARD)})`,
    ),
    check(
      `${prefixo}_chave_valida`,
      sql`${tabela.chavePredefinida} IN (${listaLiteraisTexto(CHAVES_FUNDO_BOARD)})`,
    ),
    check(
      `${prefixo}_formato_valido`,
      sql`${tabela.gradienteFormato} IN (${listaLiteraisTexto(FORMATOS_GRADIENTE)})`,
    ),
    check(
      `${prefixo}_angulo_intervalo`,
      sql`${tabela.gradienteAngulo} BETWEEN ${literalNumerico(LIMITES_GRADIENTE.ANGULO_MINIMO)} AND ${literalNumerico(LIMITES_GRADIENTE.ANGULO_MAXIMO)}`,
    ),
    check(
      `${prefixo}_cor_inicial_formato`,
      corHexadecimal(tabela.gradienteCorInicial),
    ),
    check(
      `${prefixo}_cor_intermediaria_formato`,
      sql`${tabela.gradienteCorIntermediaria} IS NULL OR ${corHexadecimal(tabela.gradienteCorIntermediaria)}`,
    ),
    check(
      `${prefixo}_cor_final_formato`,
      corHexadecimal(tabela.gradienteCorFinal),
    ),
    check(
      `${prefixo}_imagem_completa`,
      sql`(${tabela.imagemIdentificador} IS NULL) = (${tabela.imagemFormato} IS NULL) AND (${tabela.imagemIdentificador} IS NULL) = (${tabela.imagemHash} IS NULL)`,
    ),
    check(
      `${prefixo}_imagem_identificador_formato`,
      sql`${tabela.imagemIdentificador} IS NULL OR (length(${tabela.imagemIdentificador}) BETWEEN 16 AND 64 AND ${tabela.imagemIdentificador} NOT GLOB '*[^0-9a-zA-Z_-]*')`,
    ),
    check(
      `${prefixo}_imagem_formato_valido`,
      sql`${tabela.imagemFormato} IS NULL OR ${tabela.imagemFormato} IN (${listaLiteraisTexto(FORMATOS_IMAGEM_FUNDO)})`,
    ),
    check(
      `${prefixo}_imagem_hash_formato`,
      sql`${tabela.imagemHash} IS NULL OR ${hashSha256Hex(tabela.imagemHash)}`,
    ),
    check(
      `${prefixo}_imagem_exige_arquivo`,
      sql`${tabela.tipo} <> 'imagem' OR ${tabela.imagemIdentificador} IS NOT NULL`,
    ),
    check(
      `${prefixo}_imagem_cor_media_formato`,
      corHexadecimalOuNula(tabela.imagemCorMedia),
    ),
    check(`${prefixo}_cor_titulos_formato`, corHexadecimal(tabela.corTitulos)),
    check(`${prefixo}_cor_colunas_formato`, corHexadecimal(tabela.corColunas)),
    check(
      `${prefixo}_opacidade_titulos_intervalo`,
      opacidadeNoIntervalo(tabela.opacidadeTitulos),
    ),
    check(
      `${prefixo}_opacidade_colunas_intervalo`,
      opacidadeNoIntervalo(tabela.opacidadeColunas),
    ),
    check(
      `${prefixo}_tom_texto_valido`,
      sql`${tabela.tomTexto} IN (${listaLiteraisTexto(MODOS_TOM_TEXTO)})`,
    ),
    check(
      `${prefixo}_cor_prioridade_critica_formato`,
      corHexadecimalOuNula(tabela.corPrioridadeCritica),
    ),
    check(
      `${prefixo}_cor_prioridade_alta_formato`,
      corHexadecimalOuNula(tabela.corPrioridadeAlta),
    ),
    check(
      `${prefixo}_cor_prioridade_media_formato`,
      corHexadecimalOuNula(tabela.corPrioridadeMedia),
    ),
    check(
      `${prefixo}_cor_prioridade_baixa_formato`,
      corHexadecimalOuNula(tabela.corPrioridadeBaixa),
    ),
  ];
}

// Uma linha por board. Nenhuma tabela referencia esta, então ampliar o
// catálogo no futuro pode recriá-la sem cascata.
export const fundosBoard = sqliteTable(
  'fundos_board',
  {
    boardId: integer('board_id')
      .primaryKey()
      .references(() => boards.id, { onDelete: 'cascade' }),
    ...colunasAparencia(),
  },
  (tabela) => restricoesAparencia('fundos_board', tabela),
);

// A posição é única por board: reordenar exige atualizar em duas fases dentro
// de uma transação (deslocar para uma faixa livre e depois gravar a final).
export const statusBoard = sqliteTable(
  'status_board',
  {
    id: colunaId(),
    boardId: integer('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'restrict' }),
    chave: text('chave').notNull(),
    nome: text('nome').notNull(),
    posicao: integer('posicao').notNull(),
    finalizaAtividade: integer('finaliza_atividade', { mode: 'boolean' })
      .notNull()
      .default(false),
    // Nulas = a coluna usa as cores globais definidas em Aparência.
    corTitulo: text('cor_titulo'),
    corColuna: text('cor_coluna'),
    versao: colunaVersao(),
    criadoEm: colunaCriadoEm(),
    atualizadoEm: colunaAtualizadoEm(),
  },
  (tabela) => [
    uniqueIndex('status_board_chave_unica').on(tabela.boardId, tabela.chave),
    uniqueIndex('status_board_nome_unico').on(tabela.boardId, tabela.nome),
    uniqueIndex('status_board_posicao_unica').on(
      tabela.boardId,
      tabela.posicao,
    ),
    check('status_board_chave_preenchida', textoPreenchido(tabela.chave)),
    check(
      'status_board_nome_valido',
      textoComTamanho(tabela.nome, LIMITES_TEXTO.NOME_STATUS),
    ),
    check('status_board_posicao_nao_negativa', sql`${tabela.posicao} >= 0`),
    check('status_board_finaliza_booleano', booleano(tabela.finalizaAtividade)),
    check(
      'status_board_cor_titulo_formato',
      corHexadecimalOuNula(tabela.corTitulo),
    ),
    check(
      'status_board_cor_coluna_formato',
      corHexadecimalOuNula(tabela.corColuna),
    ),
    check('status_board_versao_positiva', sql`${tabela.versao} >= 1`),
  ],
);
