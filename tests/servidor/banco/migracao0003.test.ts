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
import { consultarConfiguracaoFundo } from '@/servidor/board/fundoBoard';

const MIGRACOES_ANTERIORES = [
  '0000_fundacao',
  '0001_compartilhamento_api',
  '0002_anexos_fundo_lembretes',
];

const TABELAS_COM_DADOS = [
  'boards',
  'status_board',
  'solicitantes',
  'tags',
  'atividades',
  'atividades_tags',
  'links_compartilhamento',
  'escopo_link_tags',
];

type Contagens = Record<string, number>;

function criarDiretorioComMigracoesAnteriores(): string {
  const diretorio = fs.mkdtempSync(
    path.join(os.tmpdir(), 'board-migracao-0002-'),
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

// Estado típico depois da rodada de aparência: fundo escolhido no catálogo
// antigo, link restrito com escopo e link completo.
function inserirDadosDaRodadaAnterior(banco: BancoDados): void {
  banco.$client.exec(`
    INSERT INTO boards (id, chave, nome, fuso_horario, fundo) VALUES (1, 'principal', 'Board', 'America/Sao_Paulo', 'cor-menta');
    INSERT INTO status_board (id, board_id, chave, nome, posicao) VALUES (1, 1, 'a-fazer', 'A Fazer', 0);
    INSERT INTO solicitantes (id, board_id, nome, nome_normalizado) VALUES (1, 1, 'Eu', 'eu');
    INSERT INTO tags (id, board_id, nome, nome_normalizado) VALUES (1, 1, 'Faturas', 'faturas');
    INSERT INTO atividades (id, board_id, status_id, solicitante_id, titulo, ordem) VALUES (1, 1, 1, 1, 'Fechar fatura', 0);
    INSERT INTO atividades_tags (atividade_id, tag_id) VALUES (1, 1);
    INSERT INTO links_compartilhamento (id, board_id, nome, hash_token, modalidade) VALUES (1, 1, 'Restrito', '${'a'.repeat(64)}', 'restrito');
    INSERT INTO links_compartilhamento (id, board_id, nome, hash_token, modalidade) VALUES (2, 1, 'Completo', '${'b'.repeat(64)}', 'completo');
    INSERT INTO escopo_link_tags (link_id, tag_id) VALUES (1, 1);
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

describe('migração 0003 sobre um banco da rodada de aparência', () => {
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

  it('deve preservar todas as linhas, o escopo dos links e as chaves estrangeiras', () => {
    expect(contarTabelas(banco)).toEqual(contagensAntes);
    expect(banco.$client.pragma('foreign_key_check')).toEqual([]);
    expect(contarMigracoesAplicadas(banco)).toBe(contarMigracoesDisponiveis());
  });

  it('deve levar o fundo escolhido para a tabela nova', () => {
    expect(consultarConfiguracaoFundo(banco)).toEqual(
      expect.objectContaining({
        tipo: 'predefinido',
        chavePredefinida: 'cor-menta',
        imagem: null,
      }),
    );
  });

  it('deve marcar os links existentes como não padrão, sem mudar a modalidade', () => {
    const links = banco.$client
      .prepare(
        'SELECT id, modalidade, padrao FROM links_compartilhamento ORDER BY id',
      )
      .all();

    expect(links).toEqual([
      { id: 1, modalidade: 'restrito', padrao: 0 },
      { id: 2, modalidade: 'completo', padrao: 0 },
    ]);
  });
});
