import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  abrirBanco,
  BANCO_EM_MEMORIA,
  fecharBanco,
  type BancoDados,
} from '@/servidor/banco/conexao';
import {
  aplicarMigracoes,
  contarMigracoesAplicadas,
  contarMigracoesDisponiveis,
  DIRETORIO_MIGRACOES,
} from '@/servidor/banco/migrador';
import { criarBancoMigrado } from '@/tests/suporte/bancoTeste';

const MIGRACOES_ANTERIORES = ['0000_fundacao', '0001_compartilhamento_api'];
const LEMBRETE_HISTORICO = '2026-09-30T16:45:00.000Z';
const HASH_FALSO = 'e'.repeat(64);

type Contagens = Record<string, number>;

const TABELAS_COM_DADOS = [
  'boards',
  'status_board',
  'solicitantes',
  'tags',
  'atividades',
  'atividades_tags',
  'anexos',
  'links_compartilhamento',
  'escopo_link_tags',
  'tokens_api',
  'tokens_api_permissoes',
];

function criarDiretorioComMigracoesAnteriores(): string {
  const diretorio = fs.mkdtempSync(
    path.join(os.tmpdir(), 'board-migracao-0001-'),
  );
  fs.mkdirSync(path.join(diretorio, 'meta'));
  for (const tag of MIGRACOES_ANTERIORES) {
    fs.copyFileSync(
      path.join(DIRETORIO_MIGRACOES, `${tag}.sql`),
      path.join(diretorio, `${tag}.sql`),
    );
  }
  const jornal = JSON.parse(
    fs.readFileSync(
      path.join(DIRETORIO_MIGRACOES, 'meta', '_journal.json'),
      'utf8',
    ),
  ) as { entries: unknown[] };
  fs.writeFileSync(
    path.join(diretorio, 'meta', '_journal.json'),
    JSON.stringify({
      ...jornal,
      entries: jornal.entries.slice(0, MIGRACOES_ANTERIORES.length),
    }),
  );
  return diretorio;
}

// Estado típico de um banco antes da 0002: atividades, uma com
// lembrete histórico 'disparado' sem momento de disparo, tags, anexo, link
// com escopo e token de API.
function inserirDadosDaRodadaAnterior(banco: BancoDados): void {
  banco.$client.exec(`
    INSERT INTO boards (id, chave, nome, fuso_horario) VALUES (1, 'principal', 'Board', 'America/Sao_Paulo');
    INSERT INTO status_board (id, board_id, chave, nome, posicao) VALUES (1, 1, 'a-fazer', 'A Fazer', 0);
    INSERT INTO solicitantes (id, board_id, nome, nome_normalizado) VALUES (1, 1, 'Eu', 'eu');
    INSERT INTO tags (id, board_id, nome, nome_normalizado) VALUES (1, 1, 'Faturas', 'faturas');
    INSERT INTO atividades (id, board_id, status_id, solicitante_id, titulo, ordem, lembrete_em, lembrete_situacao)
      VALUES (1, 1, 1, 1, 'Apresentação do comitê técnico', 0, '${LEMBRETE_HISTORICO}', 'disparado');
    INSERT INTO atividades (id, board_id, status_id, solicitante_id, titulo, ordem) VALUES (2, 1, 1, 1, 'Sem lembrete', 1);
    INSERT INTO atividades_tags (atividade_id, tag_id) VALUES (1, 1);
    INSERT INTO anexos (atividade_id, identificador_arquivo, nome_original, tipo_conteudo, tamanho_bytes, hash_sha256)
      VALUES (2, 'anexoLegado_0123456789', 'antigo.pdf', 'application/pdf', 10, '${HASH_FALSO}');
    INSERT INTO links_compartilhamento (id, board_id, nome, hash_token, modalidade) VALUES (1, 1, 'Link', '${'c'.repeat(64)}', 'restrito');
    INSERT INTO escopo_link_tags (link_id, tag_id) VALUES (1, 1);
    INSERT INTO tokens_api (id, nome, prefixo, hash_token) VALUES (1, 'Agente', 'bat_abcd', '${'d'.repeat(64)}');
    INSERT INTO tokens_api_permissoes (token_id, permissao) VALUES (1, 'board:escrever');
  `);
}

function contarTabelas(banco: BancoDados): Contagens {
  return Object.fromEntries(
    TABELAS_COM_DADOS.map((tabela) => [
      tabela,
      banco.$client
        .prepare(`SELECT count(*) FROM "${tabela}"`)
        .pluck()
        .get() as number,
    ]),
  );
}

function listarColunas(banco: BancoDados, tabela: string): string[] {
  return banco.$client
    .prepare(`SELECT name FROM pragma_table_info('${tabela}')`)
    .pluck()
    .all() as string[];
}

describe('migração 0002 sobre um banco da rodada 3', () => {
  let diretorioAnterior: string;
  let banco: BancoDados;
  let contagensAntes: Contagens;

  beforeEach(() => {
    diretorioAnterior = criarDiretorioComMigracoesAnteriores();
    banco = abrirBanco(BANCO_EM_MEMORIA);
    aplicarMigracoes(banco, diretorioAnterior);
    inserirDadosDaRodadaAnterior(banco);
    contagensAntes = contarTabelas(banco);
    aplicarMigracoes(banco);
  });

  afterEach(() => {
    fecharBanco(banco);
    fs.rmSync(diretorioAnterior, { recursive: true, force: true });
  });

  it('deve preservar todas as linhas e as chaves estrangeiras', () => {
    expect(contarTabelas(banco)).toEqual(contagensAntes);
    expect(banco.$client.pragma('foreign_key_check')).toEqual([]);
    expect(contarMigracoesAplicadas(banco)).toBe(contarMigracoesDisponiveis());
  });

  it('deve dar ao board existente o fundo padrão', () => {
    const fundo = banco.$client
      .prepare('SELECT fundo FROM boards')
      .pluck()
      .get();

    expect(fundo).toBe('padrao');
  });

  it('deve manter o lembrete histórico disparado, sem dispensa e fora da central', () => {
    const lembrete = banco.$client
      .prepare(
        'SELECT lembrete_em, lembrete_situacao, lembrete_disparado_em, lembrete_dispensado_em FROM atividades WHERE id = 1',
      )
      .get();

    expect(lembrete).toEqual({
      lembrete_em: LEMBRETE_HISTORICO,
      lembrete_situacao: 'disparado',
      lembrete_disparado_em: null,
      lembrete_dispensado_em: null,
    });
  });

  it('deve recusar dispensa de lembrete sem disparo registrado', () => {
    expect(() =>
      banco.$client
        .prepare(
          "UPDATE atividades SET lembrete_dispensado_em = '2026-10-01T15:00:00.000Z' WHERE id = 1",
        )
        .run(),
    ).toThrow('atividades_lembrete_dispensa_coerente');
  });

  it('deve recusar dispensa fora do formato de instante UTC', () => {
    expect(() =>
      banco.$client
        .prepare(
          "UPDATE atividades SET lembrete_disparado_em = '2026-10-01T15:00:00.000Z', lembrete_dispensado_em = 'ontem' WHERE id = 1",
        )
        .run(),
    ).toThrow('atividades_lembrete_dispensado_em_formato');
  });

  it('deve recusar fundo fora do catálogo', () => {
    expect(() =>
      banco.$client.prepare("UPDATE boards SET fundo = 'url(x)'").run(),
    ).toThrow('boards_fundo_valido');
  });

  it('deve criar o índice parcial da central de lembretes', () => {
    const indice = banco.$client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'atividades_lembretes_a_dispensar'",
      )
      .pluck()
      .get();

    expect(indice).toBe('atividades_lembretes_a_dispensar');
  });

  it('deve ser idempotente ao ser aplicada de novo', () => {
    const colunasAntes = listarColunas(banco, 'atividades');

    aplicarMigracoes(banco);

    expect(listarColunas(banco, 'atividades')).toEqual(colunasAntes);
    expect(contarTabelas(banco)).toEqual(contagensAntes);
  });
});

describe('cadeia completa em banco limpo', () => {
  it('deve criar as novas colunas de fundo e de dispensa', () => {
    const banco = criarBancoMigrado();

    const colunasBoards = listarColunas(banco, 'boards');
    const colunasAtividades = listarColunas(banco, 'atividades');
    fecharBanco(banco);

    expect(colunasBoards).toContain('fundo');
    expect(colunasAtividades).toContain('lembrete_dispensado_em');
  });

  it('deve aplicar em arquivo temporário e reabrir sem migrações pendentes', () => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'board-cadeia-'));
    const caminho = path.join(diretorio, 'board.sqlite');
    const primeira = abrirBanco(caminho);
    aplicarMigracoes(primeira);
    fecharBanco(primeira);

    const segunda = abrirBanco(caminho, { exigirArquivoExistente: true });
    const aplicadas = contarMigracoesAplicadas(segunda);
    const verificacao = segunda.$client.pragma('integrity_check', {
      simple: true,
    });
    fecharBanco(segunda);
    fs.rmSync(diretorio, { recursive: true, force: true });

    expect(aplicadas).toBe(contarMigracoesDisponiveis());
    expect(verificacao).toBe('ok');
  });
});
