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

const MIGRACOES_ANTERIORES = [
  '0000_fundacao',
  '0001_compartilhamento_api',
  '0002_anexos_fundo_lembretes',
  '0003_fundos_link_padrao',
];

const TABELAS_COM_DADOS = [
  'boards',
  'fundos_board',
  'status_board',
  'solicitantes',
  'tags',
  'atividades',
  'atividades_tags',
  'links_compartilhamento',
  'escopo_link_tags',
  'escopo_link_status',
];

const INSTANTE_VALIDO = '2026-10-02T15:00:00.000Z';

type Contagens = Record<string, number>;

function criarDiretorioComMigracoesAnteriores(): string {
  const diretorio = fs.mkdtempSync(
    path.join(os.tmpdir(), 'board-migracao-0003-'),
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

// Estado típico depois da rodada de compartilhamento: gradiente escolhido,
// status com escopo de link e tag usada por atividade e por link.
function inserirDadosDaRodadaAnterior(banco: BancoDados): void {
  banco.$client.exec(`
    INSERT INTO boards (id, chave, nome, fuso_horario) VALUES (1, 'principal', 'Board', 'America/Sao_Paulo');
    INSERT INTO fundos_board (board_id, tipo, gradiente_formato, gradiente_angulo, gradiente_cor_inicial, gradiente_cor_final) VALUES (1, 'gradiente', 'radial', 82, '#ff1af7', '#7e67e4');
    INSERT INTO status_board (id, board_id, chave, nome, posicao) VALUES (1, 1, 'a-fazer', 'A Fazer', 0);
    INSERT INTO status_board (id, board_id, chave, nome, posicao, finaliza_atividade) VALUES (2, 1, 'concluidos', 'Concluídos', 1, 1);
    INSERT INTO solicitantes (id, board_id, nome, nome_normalizado) VALUES (1, 1, 'Eu', 'eu');
    INSERT INTO tags (id, board_id, nome, nome_normalizado) VALUES (1, 1, 'Faturas', 'faturas');
    INSERT INTO atividades (id, board_id, status_id, solicitante_id, titulo, ordem) VALUES (1, 1, 1, 1, 'Fechar fatura', 0);
    INSERT INTO atividades_tags (atividade_id, tag_id) VALUES (1, 1);
    INSERT INTO links_compartilhamento (id, board_id, nome, hash_token, modalidade) VALUES (1, 1, 'Restrito', '${'a'.repeat(64)}', 'restrito');
    INSERT INTO escopo_link_tags (link_id, tag_id) VALUES (1, 1);
    INSERT INTO escopo_link_status (link_id, status_id) VALUES (1, 2);
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

describe('migração 0004 sobre um banco da rodada de compartilhamento', () => {
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

  it('deve manter o gradiente e preencher as superfícies com os padrões', () => {
    const fundo = banco.$client
      .prepare(
        `SELECT tipo, gradiente_formato, gradiente_angulo, cor_titulos, cor_colunas,
          opacidade_titulos, opacidade_colunas, tom_texto, imagem_cor_media,
          cor_prioridade_critica, cor_prioridade_baixa
         FROM fundos_board`,
      )
      .get();

    expect(fundo).toEqual({
      tipo: 'gradiente',
      gradiente_formato: 'radial',
      gradiente_angulo: 82,
      cor_titulos: '#ffffff',
      cor_colunas: '#f4f6f3',
      opacidade_titulos: 90,
      opacidade_colunas: 90,
      tom_texto: 'automatico',
      imagem_cor_media: null,
      cor_prioridade_critica: null,
      cor_prioridade_baixa: null,
    });
  });

  it('deve deixar sem cor própria os status e as tags existentes', () => {
    expect(
      banco.$client
        .prepare('SELECT cor_titulo, cor_coluna FROM status_board')
        .all(),
    ).toEqual([
      { cor_titulo: null, cor_coluna: null },
      { cor_titulo: null, cor_coluna: null },
    ]);
    expect(banco.$client.prepare('SELECT cor FROM tags').get()).toEqual({
      cor: null,
    });
  });

  it.each([
    [
      'cor de tag fora do formato',
      "UPDATE tags SET cor = 'red'",
      'tags_cor_formato',
    ],
    [
      'cor de tag em maiúsculas',
      "UPDATE tags SET cor = '#FFAA00'",
      'tags_cor_formato',
    ],
    [
      'cor de coluna inválida',
      "UPDATE status_board SET cor_coluna = '#12345'",
      'status_board_cor_coluna_formato',
    ],
    [
      'opacidade acima de 100',
      'UPDATE fundos_board SET opacidade_colunas = 101',
      'fundos_board_opacidade_colunas_intervalo',
    ],
    [
      'tom de texto desconhecido',
      "UPDATE fundos_board SET tom_texto = 'neon'",
      'fundos_board_tom_texto_valido',
    ],
    [
      'cor de prioridade inválida',
      "UPDATE fundos_board SET cor_prioridade_alta = 'url(x)'",
      'fundos_board_cor_prioridade_alta_formato',
    ],
  ])('deve recusar %s', (_caso, comando, restricao) => {
    expect(() => banco.$client.exec(comando)).toThrow(restricao);
  });

  describe('lembretes avulsos', () => {
    function inserirLembrete(colunas: string, valores: string): void {
      banco.$client.exec(
        `INSERT INTO lembretes_avulsos (board_id, titulo, lembrete_em${colunas}) VALUES (1, 'Ligar para o fornecedor', '${INSTANTE_VALIDO}'${valores})`,
      );
    }

    it('deve aceitar um lembrete pendente sem atividade', () => {
      inserirLembrete('', '');

      expect(
        banco.$client
          .prepare('SELECT situacao, versao FROM lembretes_avulsos')
          .get(),
      ).toEqual({ situacao: 'pendente', versao: 1 });
    });

    it.each([
      [
        'disparo sem situação disparado',
        ', disparado_em',
        `, '${INSTANTE_VALIDO}'`,
        'lembretes_avulsos_disparo_coerente',
      ],
      [
        'dispensa sem disparo',
        ', situacao, dispensado_em',
        `, 'disparado', '${INSTANTE_VALIDO}'`,
        'lembretes_avulsos_dispensa_coerente',
      ],
      [
        'situação desconhecida',
        ', situacao',
        ", 'adiado'",
        'lembretes_avulsos_situacao_valida',
      ],
    ])('deve recusar %s', (_caso, colunas, valores, restricao) => {
      expect(() => inserirLembrete(colunas, valores)).toThrow(restricao);
    });

    it('deve recusar instante fora do formato UTC', () => {
      expect(() =>
        banco.$client.exec(
          "INSERT INTO lembretes_avulsos (board_id, titulo, lembrete_em) VALUES (1, 'X', '02/10/2026 15:00')",
        ),
      ).toThrow('lembretes_avulsos_lembrete_em_formato');
    });

    it('deve recusar título vazio', () => {
      expect(() =>
        banco.$client.exec(
          `INSERT INTO lembretes_avulsos (board_id, titulo, lembrete_em) VALUES (1, '   ', '${INSTANTE_VALIDO}')`,
        ),
      ).toThrow('lembretes_avulsos_titulo_valido');
    });
  });
});
