import fs from 'node:fs';
import path from 'node:path';
import {
  montarComandoClaudeMcpAdd,
  montarConfiguracaoMcpAbsoluta,
  montarMcpJsonDoProjeto,
  NOME_SERVIDOR_MCP,
} from '@/screens/integracoes/configuracaoMcp';

const RAIZ = process.cwd();

describe('configuração do servidor MCP', () => {
  it('deve manter o .mcp.json do projeto igual ao exibido em Integrações', () => {
    const versionado = JSON.parse(
      fs.readFileSync(path.join(RAIZ, '.mcp.json'), 'utf8'),
    ) as unknown;

    expect(versionado).toEqual(JSON.parse(montarMcpJsonDoProjeto()));
  });

  it('deve apontar para arquivos que existem no projeto', () => {
    const configuracao = JSON.parse(montarConfiguracaoMcpAbsoluta(RAIZ)) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    const servidor = configuracao.mcpServers[NOME_SERVIDOR_MCP];
    const arquivos = servidor?.args.filter((argumento) =>
      path.isAbsolute(argumento),
    );

    expect(servidor?.command).toBe('node');
    expect(arquivos).toHaveLength(3);
    for (const arquivo of arquivos ?? []) {
      expect(fs.existsSync(arquivo)).toBe(true);
    }
  });

  it('deve montar o comando do Claude Code com os caminhos entre aspas', () => {
    const comando = montarComandoClaudeMcpAdd(RAIZ);

    expect(comando).toMatch(
      /^claude mcp add --scope user board-atividades -- node "/,
    );
    expect(comando).toContain('--tsconfig "');
    expect(comando).toContain('servidorMcp.ts"');
  });
});
