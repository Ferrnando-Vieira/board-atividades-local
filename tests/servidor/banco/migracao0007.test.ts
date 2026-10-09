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

const QUANTIDADE_MIGRACOES_ANTERIORES = 7;

const TABELAS_COM_DADOS = [
  'boards',
  'status_board',
  'solicitantes',
  'atividades',
  'links_compartilhamento',
  'escopo_link_solicitantes',
];

type Contagens = Record<string, number>;

function criarDiretorioComMigracoesAnteriores(): string {
  const diretorio = fs.mkdtempSync(
    path.join(os.tmpdir(), 'board-migracao-0006-'),
  );
  fs.mkdirSync(path.join(diretorio, 'meta'));
  const jornal = JSON.parse(
    fs.readFileSync(
      path.join(DIRETORIO_MIGRACOES, 'meta', '_journal.json'),
      'utf8',
    ),
  ) as { entries: { tag: string }[] };
  const anteriores = jornal.entries.slice(0, QUANTIDADE_MIGRACOES_ANTERIORES);
  for (const { tag } of anteriores) {
    fs.copyFileSync(
      path.join(DIRETORIO_MIGRACOES, `${tag}.sql`),
      path.join(diretorio, `${tag}.sql`),
    );
  }
  fs.writeFileSync(
    path.join(diretorio, 'meta', '_journal.json'),
    JSON.stringify({ ...jornal, entries: anteriores }),
  );
  return diretorio;
}

// Antes da 0007 o solicitante padrão nascia junto com o board, então é o de
// menor id; os demais foram cadastrados depois, ao salvar atividades. O
// segundo board confere que a marca é por board.
function inserirDadosDaVersaoAnterior(banco: BancoDados): void {
  banco.$client.exec(`
    INSERT INTO boards (id, chave, nome, fuso_horario) VALUES (1, 'principal', 'Board', 'America/Sao_Paulo');
    INSERT INTO boards (id, chave, nome, fuso_horario) VALUES (2, 'outro', 'Outro board', 'America/Sao_Paulo');
    INSERT INTO status_board (id, board_id, chave, nome, posicao) VALUES (1, 1, 'a-fazer', 'A Fazer', 0);
    INSERT INTO solicitantes (id, board_id, nome, nome_normalizado) VALUES (1, 1, 'Criado com o board', 'criado com o board');
    INSERT INTO solicitantes (id, board_id, nome, nome_normalizado) VALUES (2, 1, 'Financeiro', 'financeiro');
    INSERT INTO solicitantes (id, board_id, nome, nome_normalizado) VALUES (3, 2, 'Primeiro do outro', 'primeiro do outro');
    INSERT INTO solicitantes (id, board_id, nome, nome_normalizado) VALUES (4, 1, 'Diretoria', 'diretoria');
    INSERT INTO solicitantes (id, board_id, nome, nome_normalizado) VALUES (5, 2, 'Segundo do outro', 'segundo do outro');
    INSERT INTO atividades (id, board_id, status_id, solicitante_id, titulo, ordem) VALUES (1, 1, 1, 2, 'Fechar fatura', 0);
    INSERT INTO atividades (id, board_id, status_id, solicitante_id, titulo, ordem) VALUES (2, 1, 1, 1, 'Revisar contrato', 1);
    INSERT INTO links_compartilhamento (id, board_id, nome, hash_token, modalidade) VALUES (1, 1, 'Restrito', '${'a'.repeat(64)}', 'restrito');
    INSERT INTO escopo_link_solicitantes (link_id, solicitante_id) VALUES (1, 2);
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

describe('migração 0007 sobre um banco da versão anterior', () => {
  let diretorioAnterior: string;
  let banco: BancoDados;
  let contagensAntes: Contagens;

  beforeEach(() => {
    diretorioAnterior = criarDiretorioComMigracoesAnteriores();
    banco = abrirBanco(BANCO_EM_MEMORIA);
    aplicarMigracoes(banco, diretorioAnterior);
    inserirDadosDaVersaoAnterior(banco);
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

  it('deve marcar como padrão só o solicitante mais antigo de cada board', () => {
    expect(
      banco.$client
        .prepare('SELECT id, padrao FROM solicitantes ORDER BY id')
        .all(),
    ).toEqual([
      { id: 1, padrao: 1 },
      { id: 2, padrao: 0 },
      { id: 3, padrao: 1 },
      { id: 4, padrao: 0 },
      { id: 5, padrao: 0 },
    ]);
  });

  it('deve recusar um segundo padrão no mesmo board', () => {
    expect(() =>
      banco.$client
        .prepare('UPDATE solicitantes SET padrao = 1 WHERE id = 2')
        .run(),
    ).toThrow('UNIQUE constraint failed');
  });

  it('deve recusar valor fora de 0 e 1', () => {
    expect(() =>
      banco.$client
        .prepare('UPDATE solicitantes SET padrao = 2 WHERE id = 4')
        .run(),
    ).toThrow('solicitantes_padrao_booleano');
  });
});
