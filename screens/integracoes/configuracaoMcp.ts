import path from 'node:path';

export const NOME_SERVIDOR_MCP = 'board-atividades';

const RECUO_JSON = 2;
const CAMINHO_CLI_TSX = ['node_modules', 'tsx', 'dist', 'cli.mjs'];
const CAMINHO_SCRIPT_MCP = ['scripts', 'servidorMcp.ts'];
const ARQUIVO_TSCONFIG = 'tsconfig.json';

// O servidor MCP roda o TypeScript do projeto com o tsx; o --tsconfig deixa
// os atalhos de importação (@/...) funcionarem mesmo quando o cliente inicia
// o processo em outra pasta.
function montarArgumentos(raiz: string, juntar: typeof path.join): string[] {
  return [
    juntar(raiz, ...CAMINHO_CLI_TSX),
    '--tsconfig',
    juntar(raiz, ARQUIVO_TSCONFIG),
    juntar(raiz, ...CAMINHO_SCRIPT_MCP),
  ];
}

// Igual ao .mcp.json versionado na raiz: caminhos relativos à pasta do
// projeto, onde o Claude Code inicia os servidores do projeto.
export function montarMcpJsonDoProjeto(): string {
  return JSON.stringify(
    {
      mcpServers: {
        [NOME_SERVIDOR_MCP]: {
          type: 'stdio',
          command: 'node',
          args: montarArgumentos('', path.posix.join),
        },
      },
    },
    null,
    RECUO_JSON,
  );
}

// Para outros clientes (Kiro, Claude Desktop…): caminhos absolutos desta
// instalação. O token fica no .env.local do projeto, lido pelo servidor.
export function montarConfiguracaoMcpAbsoluta(raiz: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        [NOME_SERVIDOR_MCP]: {
          command: 'node',
          args: montarArgumentos(raiz, path.join),
        },
      },
    },
    null,
    RECUO_JSON,
  );
}

function citar(argumento: string): string {
  return `"${argumento}"`;
}

export function montarComandoClaudeMcpAdd(raiz: string): string {
  return [
    'claude mcp add --scope user',
    NOME_SERVIDOR_MCP,
    '-- node',
    ...montarArgumentos(raiz, path.join).map((argumento) =>
      argumento.startsWith('--') ? argumento : citar(argumento),
    ),
  ].join(' ');
}
