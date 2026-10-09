import fs from 'node:fs';
import path from 'node:path';
import { lerAmbiente } from '@/config/ambiente';
import { CATALOGO_API } from '@/servidor/api/catalogoApi';

const DIRETORIO_PROJETO = process.cwd();
const NOME_VARIAVEL = /^[A-Z][A-Z0-9_]*$/;
const LINHA_VARIAVEL = /^([A-Z][A-Z0-9_]*)=(.*)$/;
const COMANDO_NPM_RUN = /npm run ([a-z0-9:-]+)/g;
const COMANDO_NPM_DIRETO = /npm (start|test)\b/g;
const LINHA_ENDPOINT =
  /^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/gm;
const SEM_PERMISSAO_NA_DOCUMENTACAO = 'qualquer token';

function lerArquivoDoProjeto(...partes: string[]): string {
  return fs.readFileSync(path.join(DIRETORIO_PROJETO, ...partes), 'utf8');
}

function lerVariaveisDoExemplo(): Record<string, string> {
  return Object.fromEntries(
    lerArquivoDoProjeto('.env.example')
      .split(/\r?\n/)
      .flatMap((linha) => {
        const correspondencia = LINHA_VARIAVEL.exec(linha.trim());
        return correspondencia
          ? [[correspondencia[1] ?? '', correspondencia[2] ?? '']]
          : [];
      }),
  );
}

// Registra cada variável que a leitura do ambiente consulta, sem depender de
// uma lista mantida à mão em paralelo ao esquema.
function listarVariaveisLidasPeloAmbiente(): string[] {
  const lidas = new Set<string>();
  const variaveis = new Proxy<Record<string, string | undefined>>(
    {},
    {
      get(_alvo, chave) {
        if (typeof chave === 'string' && NOME_VARIAVEL.test(chave)) {
          lidas.add(chave);
        }
        return undefined;
      },
    },
  );
  lerAmbiente(variaveis, DIRETORIO_PROJETO);
  return [...lidas].sort();
}

function listarScriptsDoPacote(): string[] {
  const pacote = JSON.parse(lerArquivoDoProjeto('package.json')) as {
    scripts: Record<string, string>;
  };
  return Object.keys(pacote.scripts).sort();
}

function listarScriptsCitados(texto: string): string[] {
  const citados = new Set<string>();
  for (const correspondencia of texto.matchAll(COMANDO_NPM_RUN)) {
    citados.add(correspondencia[1] ?? '');
  }
  for (const correspondencia of texto.matchAll(COMANDO_NPM_DIRETO)) {
    citados.add(correspondencia[1] ?? '');
  }
  return [...citados].sort();
}

function descreverEndpoint(
  metodo: string,
  caminho: string,
  permissoes: readonly string[],
): string {
  return `${metodo} ${caminho} [${[...permissoes].sort().join(', ')}]`;
}

function listarEndpointsDocumentados(): string[] {
  const documento = lerArquivoDoProjeto('docs', 'api-agentes.md');
  return [...documento.matchAll(LINHA_ENDPOINT)]
    .map(([, metodo = '', caminho = '', celulaPermissao = '']) => {
      const permissao = celulaPermissao.replaceAll('`', '').trim();
      return descreverEndpoint(
        metodo,
        caminho,
        permissao === SEM_PERMISSAO_NA_DOCUMENTACAO ? [] : [permissao],
      );
    })
    .sort();
}

describe('documentação e configuração de exemplo', () => {
  describe('.env.example', () => {
    it('deve listar exatamente as variáveis lidas pela aplicação', () => {
      const declaradas = Object.keys(lerVariaveisDoExemplo()).sort();

      expect(declaradas).toEqual(listarVariaveisLidasPeloAmbiente());
    });

    it('deve ter valores válidos que mantêm o board só nesta máquina e sem cookie Secure', () => {
      const ambiente = lerAmbiente(lerVariaveisDoExemplo(), DIRETORIO_PROJETO);

      expect(ambiente.host).toBe('127.0.0.1');
      expect(ambiente.urlBaseLan).toBe(`http://127.0.0.1:${ambiente.porta}`);
      expect(ambiente.cookieSeguro).toBe(false);
    });
  });

  describe('README.md', () => {
    it('deve citar apenas scripts que existem no package.json', () => {
      const existentes = new Set(listarScriptsDoPacote());

      const inexistentes = listarScriptsCitados(
        lerArquivoDoProjeto('README.md'),
      ).filter((script) => !existentes.has(script));

      expect(inexistentes).toEqual([]);
    });

    it('deve documentar todos os scripts do package.json', () => {
      const citados = new Set(
        listarScriptsCitados(lerArquivoDoProjeto('README.md')),
      );

      const ausentes = listarScriptsDoPacote().filter(
        (script) => !citados.has(script),
      );

      expect(ausentes).toEqual([]);
    });
  });

  describe('docs/api-agentes.md', () => {
    it('deve descrever os mesmos endpoints, métodos e permissões do catálogo da API', () => {
      const catalogo = CATALOGO_API.map((endpoint) =>
        descreverEndpoint(
          endpoint.metodo,
          endpoint.caminho,
          endpoint.permissoes,
        ),
      ).sort();

      expect(listarEndpointsDocumentados()).toEqual(catalogo);
    });
  });
});
