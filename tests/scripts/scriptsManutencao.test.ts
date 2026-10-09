import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emitirCodigoConfiguracao } from '@/servidor/administracao/configuracaoInicial';
import { criarBackup } from '@/servidor/backup/backupServico';
import {
  abrirBanco,
  fecharBanco,
  type BancoDados,
} from '@/servidor/banco/conexao';
import {
  aplicarMigracoes,
  contarMigracoesDisponiveis,
} from '@/servidor/banco/migrador';
import { garantirBoardPadrao } from '@/servidor/board/boardRepositorio';
import { calcularHashToken } from '@/servidor/seguranca/tokens';

const DIRETORIO_PROJETO = process.cwd();
const CLI_TSX = path.join(
  DIRETORIO_PROJETO,
  'node_modules',
  'tsx',
  'dist',
  'cli.mjs',
);
const EXECUTOR_DOS_SCRIPTS = 'tsx';
const TEMPO_LIMITE_MS = 60_000;
const PADRAO_CODIGO = /[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){3}/;

type PacoteNpm = { scripts: Record<string, string> };

const PACOTE = JSON.parse(
  fs.readFileSync(path.join(DIRETORIO_PROJETO, 'package.json'), 'utf8'),
) as PacoteNpm;

type Cenario = {
  raiz: string;
  caminhoBanco: string;
  diretorioAnexos: string;
};

type Execucao = {
  codigoSaida: number | null;
  saida: string;
};

function criarCenario(): Cenario {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'board-scripts-'));
  return {
    raiz,
    caminhoBanco: path.join(raiz, 'dados', 'board.sqlite'),
    diretorioAnexos: path.join(raiz, 'dados', 'anexos'),
  };
}

// Executa exatamente o comando registrado no package.json, trocando só o
// "tsx" do PATH pelo mesmo binário instalado, e sempre contra o temporário.
function executarScriptNpm(
  nome: string,
  cenario: Cenario,
  argumentos: readonly string[] = [],
): Execucao {
  const [executavel, ...partes] = (PACOTE.scripts[nome] ?? '').split(' ');
  if (executavel !== EXECUTOR_DOS_SCRIPTS) {
    throw new Error(`Script npm inesperado: ${nome}`);
  }
  if (!cenario.caminhoBanco.startsWith(os.tmpdir())) {
    throw new Error('O teste só pode usar banco temporário.');
  }
  const resultado = spawnSync(
    process.execPath,
    [CLI_TSX, ...partes, ...argumentos],
    {
      cwd: DIRETORIO_PROJETO,
      encoding: 'utf8',
      env: {
        ...process.env,
        CAMINHO_BANCO_SQLITE: cenario.caminhoBanco,
        DIRETORIO_ANEXOS: cenario.diretorioAnexos,
        INIT_CWD: cenario.raiz,
      },
    },
  );
  return {
    codigoSaida: resultado.status,
    saida: `${resultado.stdout}${resultado.stderr}`,
  };
}

function prepararBancoInicializado(cenario: Cenario): BancoDados {
  const banco = abrirBanco(cenario.caminhoBanco);
  aplicarMigracoes(banco);
  garantirBoardPadrao(banco);
  return banco;
}

function lerNumeroDaSaida(saida: string, rotulo: string): number | null {
  const linha = saida.split(/\r?\n/).find((texto) => texto.startsWith(rotulo));
  return linha ? Number(linha.slice(rotulo.length).trim()) : null;
}

function lerHashCodigoGravado(cenario: Cenario): unknown {
  const banco = abrirBanco(cenario.caminhoBanco, {
    exigirArquivoExistente: true,
  });
  try {
    return banco.$client
      .prepare('SELECT hash_codigo FROM codigo_configuracao_inicial')
      .pluck()
      .get();
  } finally {
    fecharBanco(banco);
  }
}

describe('scripts de manutenção (comandos do package.json)', () => {
  let cenario: Cenario;

  beforeEach(() => {
    cenario = criarCenario();
  });

  afterEach(() => {
    fs.rmSync(cenario.raiz, { recursive: true, force: true });
  });

  it(
    'inicializar deve criar o banco migrado, o board e um código de uso único',
    () => {
      const execucao = executarScriptNpm('inicializar', cenario);

      expect(execucao.codigoSaida).toBe(0);
      expect(lerNumeroDaSaida(execucao.saida, 'Migrações registradas:')).toBe(
        contarMigracoesDisponiveis(),
      );
      expect(execucao.saida).toContain(
        'Board criado com 4 status iniciais e sem atividades.',
      );
      expect(execucao.saida).toMatch(PADRAO_CODIGO);
      expect(fs.existsSync(cenario.diretorioAnexos)).toBe(true);
    },
    TEMPO_LIMITE_MS,
  );

  // Instalação nova: nenhuma atividade pré-carregada e nenhum nome gravado;
  // o solicitante padrão vem da configuração inicial.
  it(
    'inicializar deve deixar o board sem atividades e sem solicitantes',
    () => {
      executarScriptNpm('inicializar', cenario);

      const banco = abrirBanco(cenario.caminhoBanco, {
        exigirArquivoExistente: true,
      });
      try {
        const contar = (tabela: string) =>
          banco.$client
            .prepare(`SELECT count(*) FROM "${tabela}"`)
            .pluck()
            .get();
        expect(contar('atividades')).toBe(0);
        expect(contar('solicitantes')).toBe(0);
        expect(contar('tags')).toBe(0);
      } finally {
        fecharBanco(banco);
      }
    },
    TEMPO_LIMITE_MS,
  );

  it(
    'db:migrar não deve aplicar nada num banco já migrado',
    () => {
      fecharBanco(prepararBancoInicializado(cenario));

      const execucao = executarScriptNpm('db:migrar', cenario);

      expect(execucao.codigoSaida).toBe(0);
      expect(execucao.saida).toContain(
        `Migrações aplicadas agora: 0. Total registrado: ${contarMigracoesDisponiveis()}.`,
      );
    },
    TEMPO_LIMITE_MS,
  );

  it(
    'admin:codigo deve substituir o código anterior',
    () => {
      const banco = prepararBancoInicializado(cenario);
      const anterior = emitirCodigoConfiguracao(banco).codigo;
      fecharBanco(banco);

      const execucao = executarScriptNpm('admin:codigo', cenario);
      const novo = PADRAO_CODIGO.exec(execucao.saida)?.[0];

      expect(execucao.codigoSaida).toBe(0);
      expect(novo).toBeDefined();
      expect(novo).not.toBe(anterior);
      expect(lerHashCodigoGravado(cenario)).toBe(calcularHashToken(novo ?? ''));
    },
    TEMPO_LIMITE_MS,
  );

  it(
    'backup:criar e backup:verificar devem gerar e conferir o backup',
    () => {
      fecharBanco(prepararBancoInicializado(cenario));

      const criacao = executarScriptNpm('backup:criar', cenario, ['copias']);
      const [pasta = ''] = fs.readdirSync(path.join(cenario.raiz, 'copias'));
      const verificacao = executarScriptNpm('backup:verificar', cenario, [
        path.join('copias', pasta),
      ]);

      expect(criacao.codigoSaida).toBe(0);
      expect(pasta).toMatch(/^backup-/);
      expect(verificacao.codigoSaida).toBe(0);
      expect(verificacao.saida).toContain('Backup válido');
    },
    TEMPO_LIMITE_MS,
  );

  it(
    'backup:restaurar só deve alterar o banco com --confirmar',
    async () => {
      fecharBanco(prepararBancoInicializado(cenario));
      const { diretorio } = await criarBackup({
        caminhoBanco: cenario.caminhoBanco,
        diretorioAnexos: cenario.diretorioAnexos,
        diretorioDestino: path.join(cenario.raiz, 'copias'),
      });
      const conteudoAntes = fs.readFileSync(cenario.caminhoBanco);

      const simulacao = executarScriptNpm('backup:restaurar', cenario, [
        diretorio,
      ]);
      const conteudoAposSimulacao = fs.readFileSync(cenario.caminhoBanco);
      const restauracao = executarScriptNpm('backup:restaurar', cenario, [
        diretorio,
        '--confirmar',
      ]);

      expect(simulacao.codigoSaida).toBe(0);
      expect(simulacao.saida).toContain('Nada foi alterado');
      expect(conteudoAposSimulacao.equals(conteudoAntes)).toBe(true);
      expect(restauracao.codigoSaida).toBe(0);
      expect(restauracao.saida).toContain('O estado anterior foi guardado em:');
    },
    TEMPO_LIMITE_MS,
  );

  it(
    'backup:verificar sem pasta deve mostrar o uso e falhar',
    () => {
      const execucao = executarScriptNpm('backup:verificar', cenario);

      expect(execucao.codigoSaida).toBe(1);
      expect(execucao.saida).toContain('Uso: npm run backup:verificar');
    },
    TEMPO_LIMITE_MS,
  );
});
