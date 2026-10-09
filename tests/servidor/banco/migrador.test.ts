import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  abrirBanco,
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

const TABELAS_DA_FUNDACAO = [
  'administrador',
  'anexos',
  'aparencias_link',
  'atividades',
  'atividades_tags',
  'boards',
  'codigo_configuracao_inicial',
  'escopo_link_solicitantes',
  'escopo_link_status',
  'escopo_link_tags',
  'fundos_board',
  'historico_atividades',
  'lembretes_avulsos',
  'links_compartilhamento',
  'sessoes_administrativas',
  'solicitantes',
  'status_board',
  'tags',
  'tokens_api',
  'tokens_api_permissoes',
];
const PRIORIDADE_PADRAO_ESPERADA = 5;
const PRIORIDADE_ACIMA_DO_LIMITE = 10;
const PRIORIDADE_ABAIXO_DO_LIMITE = -1;
const INSTANTE_ARQUIVAMENTO = '2026-10-01T12:00:00.000Z';

function listarTabelas(banco: BancoDados): string[] {
  return (
    banco.$client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '__drizzle_migrations' ORDER BY name",
      )
      .all() as { name: string }[]
  ).map((linha) => linha.name);
}

function inserirEstruturaMinima(banco: BancoDados): void {
  banco.$client.exec(`
    INSERT INTO boards (id, chave, nome, fuso_horario) VALUES (1, 'teste', 'Teste', 'America/Sao_Paulo');
    INSERT INTO status_board (id, board_id, chave, nome, posicao) VALUES (1, 1, 'a-fazer', 'A Fazer', 0);
    INSERT INTO solicitantes (id, board_id, nome, nome_normalizado) VALUES (1, 1, 'Eu', 'eu');
  `);
}

function inserirAtividade(
  banco: BancoDados,
  valores: { ordem: number; prioridade?: number; arquivadaEm?: string },
) {
  return banco.$client
    .prepare(
      'INSERT INTO atividades (board_id, status_id, solicitante_id, titulo, ordem, prioridade, arquivada_em) VALUES (1, 1, 1, ?, ?, coalesce(?, 5), ?)',
    )
    .run(
      'Atividade de teste',
      valores.ordem,
      valores.prioridade ?? null,
      valores.arquivadaEm ?? null,
    );
}

describe('migrador', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoMigrado();
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('aplicarMigracoes', () => {
    it('deve criar todas as tabelas da fundação', () => {
      const tabelas = listarTabelas(banco);

      expect(tabelas).toEqual(TABELAS_DA_FUNDACAO);
    });

    it('deve registrar todas as migrações disponíveis no jornal', () => {
      const aplicadas = contarMigracoesAplicadas(banco);

      expect(aplicadas).toBe(contarMigracoesDisponiveis());
    });

    it('deve ser idempotente quando executado novamente', () => {
      const aplicadasAntes = contarMigracoesAplicadas(banco);

      aplicarMigracoes(banco);

      expect(contarMigracoesAplicadas(banco)).toBe(aplicadasAntes);
      expect(listarTabelas(banco)).toEqual(TABELAS_DA_FUNDACAO);
    });

    it('deve manter as chaves estrangeiras ativas na conexão', () => {
      const chavesEstrangeiras = banco.$client.pragma('foreign_keys', {
        simple: true,
      });

      expect(chavesEstrangeiras).toBe(1);
    });
  });

  describe('constraints de atividades', () => {
    beforeEach(() => {
      inserirEstruturaMinima(banco);
    });

    it('deve aplicar a prioridade padrão 5 quando ela não é informada', () => {
      inserirAtividade(banco, { ordem: 0 });

      const atividade = banco.$client
        .prepare('SELECT prioridade FROM atividades')
        .get() as { prioridade: number };

      expect(atividade.prioridade).toBe(PRIORIDADE_PADRAO_ESPERADA);
    });

    it('deve recusar prioridade acima de 9', () => {
      expect(() =>
        inserirAtividade(banco, {
          ordem: 0,
          prioridade: PRIORIDADE_ACIMA_DO_LIMITE,
        }),
      ).toThrow('atividades_prioridade_intervalo');
    });

    it('deve recusar prioridade abaixo de 0', () => {
      expect(() =>
        inserirAtividade(banco, {
          ordem: 0,
          prioridade: PRIORIDADE_ABAIXO_DO_LIMITE,
        }),
      ).toThrow('atividades_prioridade_intervalo');
    });

    it('deve recusar ordem repetida entre atividades ativas do mesmo status', () => {
      inserirAtividade(banco, { ordem: 0 });

      expect(() => inserirAtividade(banco, { ordem: 0 })).toThrow(
        'UNIQUE constraint failed',
      );
    });

    it('deve permitir a mesma ordem para uma atividade arquivada', () => {
      inserirAtividade(banco, { ordem: 0 });

      const resultado = inserirAtividade(banco, {
        ordem: 0,
        arquivadaEm: INSTANTE_ARQUIVAMENTO,
      });

      expect(resultado.changes).toBe(1);
    });

    it('deve recusar status inexistente pela chave estrangeira', () => {
      expect(() =>
        banco.$client
          .prepare(
            "INSERT INTO atividades (board_id, status_id, solicitante_id, titulo, ordem) VALUES (1, 999, 1, 'x', 0)",
          )
          .run(),
      ).toThrow('FOREIGN KEY constraint failed');
    });

    it('deve recusar data de prazo inexistente no calendário', () => {
      expect(() =>
        banco.$client
          .prepare(
            "INSERT INTO atividades (board_id, status_id, solicitante_id, titulo, ordem, prazo_data) VALUES (1, 1, 1, 'x', 0, '2026-02-30')",
          )
          .run(),
      ).toThrow('atividades_prazo_data_formato');
    });

    it('deve recusar horário de prazo sem data', () => {
      expect(() =>
        banco.$client
          .prepare(
            "INSERT INTO atividades (board_id, status_id, solicitante_id, titulo, ordem, prazo_hora) VALUES (1, 1, 1, 'x', 0, '10:00')",
          )
          .run(),
      ).toThrow('atividades_prazo_hora_exige_data');
    });
  });

  describe('constraints de administração', () => {
    it('deve impedir mais de um registro de administrador', () => {
      expect(() =>
        banco.$client
          .prepare(
            "INSERT INTO administrador (id, usuario, hash_senha, senha_alterada_em) VALUES (2, 'admin', 'scrypt$x', '2026-10-01T12:00:00.000Z')",
          )
          .run(),
      ).toThrow('administrador_registro_unico');
    });

    it('deve recusar senha armazenada fora do formato de hash scrypt', () => {
      expect(() =>
        banco.$client
          .prepare(
            "INSERT INTO administrador (id, usuario, hash_senha, senha_alterada_em) VALUES (1, 'admin', 'senha-em-texto', '2026-10-01T12:00:00.000Z')",
          )
          .run(),
      ).toThrow('administrador_hash_senha_formato');
    });

    it('deve recusar permissão de token de API fora do catálogo', () => {
      banco.$client
        .prepare(
          "INSERT INTO tokens_api (id, nome, prefixo, hash_token) VALUES (1, 'Integração', 'bat_abcd', ?)",
        )
        .run('a'.repeat(64));

      expect(() =>
        banco.$client
          .prepare(
            "INSERT INTO tokens_api_permissoes (token_id, permissao) VALUES (1, 'tudo:liberado')",
          )
          .run(),
      ).toThrow('tokens_api_permissoes_catalogo');
    });

    it('deve aceitar a permissão board:escrever da migração 0001', () => {
      banco.$client
        .prepare(
          "INSERT INTO tokens_api (id, nome, prefixo, hash_token) VALUES (1, 'Integração', 'bat_abcd', ?)",
        )
        .run('a'.repeat(64));

      const resultado = banco.$client
        .prepare(
          "INSERT INTO tokens_api_permissoes (token_id, permissao) VALUES (1, 'board:escrever'), (1, 'anexos:ler')",
        )
        .run();

      expect(resultado.changes).toBe(2);
    });
  });

  describe('constraints de compartilhamento', () => {
    beforeEach(() => {
      inserirEstruturaMinima(banco);
    });

    function inserirLink(modalidade?: string) {
      const colunas = modalidade === undefined ? '' : ', modalidade';
      const valores = modalidade === undefined ? '' : ', ?';
      return banco.$client
        .prepare(
          `INSERT INTO links_compartilhamento (board_id, nome, hash_token${colunas}) VALUES (1, 'Link', ?${valores})`,
        )
        .run(
          ...[
            'b'.repeat(64),
            ...(modalidade === undefined ? [] : [modalidade]),
          ],
        );
    }

    it('deve gravar a modalidade restrita por padrão', () => {
      inserirLink();

      const link = banco.$client
        .prepare('SELECT modalidade FROM links_compartilhamento')
        .get() as { modalidade: string };

      expect(link.modalidade).toBe('restrito');
    });

    it('deve recusar modalidade fora do catálogo', () => {
      expect(() => inserirLink('administrador')).toThrow(
        'links_compartilhamento_modalidade_valida',
      );
    });

    it('deve recusar token de link guardado fora do formato de hash', () => {
      expect(() =>
        banco.$client
          .prepare(
            "INSERT INTO links_compartilhamento (board_id, nome, hash_token) VALUES (1, 'Link', 'token-em-texto')",
          )
          .run(),
      ).toThrow('links_compartilhamento_hash_formato');
    });
  });
});

describe('migração 0001 sobre um banco da rodada anterior', () => {
  let diretorioSoFundacao: string;

  beforeEach(() => {
    diretorioSoFundacao = fs.mkdtempSync(
      path.join(os.tmpdir(), 'board-migracao-0000-'),
    );
    fs.mkdirSync(path.join(diretorioSoFundacao, 'meta'));
    fs.copyFileSync(
      path.join(DIRETORIO_MIGRACOES, '0000_fundacao.sql'),
      path.join(diretorioSoFundacao, '0000_fundacao.sql'),
    );
    const jornal = JSON.parse(
      fs.readFileSync(
        path.join(DIRETORIO_MIGRACOES, 'meta', '_journal.json'),
        'utf8',
      ),
    ) as { entries: unknown[] };
    fs.writeFileSync(
      path.join(diretorioSoFundacao, 'meta', '_journal.json'),
      JSON.stringify({ ...jornal, entries: jornal.entries.slice(0, 1) }),
    );
  });

  afterEach(() => {
    fs.rmSync(diretorioSoFundacao, { recursive: true, force: true });
  });

  it('deve preservar links, escopo e permissões já gravados', () => {
    const banco = abrirBanco(':memory:');
    aplicarMigracoes(banco, diretorioSoFundacao);
    inserirEstruturaMinima(banco);
    banco.$client.exec(`
      INSERT INTO tags (id, board_id, nome, nome_normalizado) VALUES (1, 1, 'Faturas', 'faturas');
      INSERT INTO links_compartilhamento (id, board_id, nome, hash_token) VALUES (1, 1, 'Antigo', '${'c'.repeat(64)}');
      INSERT INTO escopo_link_tags (link_id, tag_id) VALUES (1, 1);
      INSERT INTO tokens_api (id, nome, prefixo, hash_token) VALUES (1, 'Agente', 'bat_abcd', '${'d'.repeat(64)}');
      INSERT INTO tokens_api_permissoes (token_id, permissao) VALUES (1, 'atividades:ler');
    `);

    aplicarMigracoes(banco);

    const escopo = banco.$client
      .prepare('SELECT link_id, tag_id FROM escopo_link_tags')
      .all();
    const link = banco.$client
      .prepare('SELECT nome, modalidade FROM links_compartilhamento')
      .get();
    const permissoes = banco.$client
      .prepare('SELECT permissao FROM tokens_api_permissoes')
      .all();
    const violacoes = banco.$client.pragma('foreign_key_check');
    const aplicadas = contarMigracoesAplicadas(banco);
    fecharBanco(banco);

    expect(escopo).toEqual([{ link_id: 1, tag_id: 1 }]);
    expect(link).toEqual({ nome: 'Antigo', modalidade: 'restrito' });
    expect(permissoes).toEqual([{ permissao: 'atividades:ler' }]);
    expect(violacoes).toEqual([]);
    expect(aplicadas).toBe(contarMigracoesDisponiveis());
  });
});

describe('migração em arquivo', () => {
  let diretorioTemporario: string;

  beforeEach(() => {
    diretorioTemporario = fs.mkdtempSync(
      path.join(os.tmpdir(), 'board-atividades-'),
    );
  });

  afterEach(() => {
    fs.rmSync(diretorioTemporario, { recursive: true, force: true });
  });

  it('deve criar o arquivo do banco em modo WAL e reaplicar sem alterações', () => {
    const caminhoBanco = path.join(diretorioTemporario, 'sub', 'board.sqlite');
    const primeiraAbertura = abrirBanco(caminhoBanco);
    aplicarMigracoes(primeiraAbertura);
    fecharBanco(primeiraAbertura);

    const segundaAbertura = abrirBanco(caminhoBanco, {
      exigirArquivoExistente: true,
    });
    aplicarMigracoes(segundaAbertura);
    const modoDiario = segundaAbertura.$client.pragma('journal_mode', {
      simple: true,
    });
    const aplicadas = contarMigracoesAplicadas(segundaAbertura);
    fecharBanco(segundaAbertura);

    expect(fs.existsSync(caminhoBanco)).toBe(true);
    expect(modoDiario).toBe('wal');
    expect(aplicadas).toBe(contarMigracoesDisponiveis());
  });
});
