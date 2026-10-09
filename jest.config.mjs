import fs from 'node:fs';
import path from 'node:path';
import nextJest from 'next/jest.js';

const criarConfiguracaoJest = nextJest({ dir: './' });

// O renderizador da descrição (react-markdown, remark e o ecossistema
// unified) só é publicado como ESM, que o Jest não carrega por require. A
// lista sai da árvore de dependências instalada, para não precisar de
// manutenção a cada atualização de versão.
const PACOTES_MARKDOWN = ['react-markdown', 'remark-gfm', 'remark-breaks'];

// Resolve como o Node: primeiro o node_modules do próprio pacote (versões
// aninhadas), depois os dos diretórios acima, até a raiz do projeto.
function resolverPacote(nome, diretorioOrigem) {
  let diretorio = diretorioOrigem;
  for (;;) {
    const candidato = path.join(diretorio, 'node_modules', nome);
    if (fs.existsSync(path.join(candidato, 'package.json'))) {
      return candidato;
    }
    if (path.resolve(diretorio) === path.resolve('.')) {
      return null;
    }
    diretorio = path.dirname(path.dirname(diretorio));
  }
}

function listarPacotesEsm(raizes) {
  const visitados = new Set();
  const esm = new Set();
  const pendentes = raizes.map((nome) => ({ nome, origem: '.' }));
  while (pendentes.length > 0) {
    const { nome, origem } = pendentes.pop();
    const diretorio = resolverPacote(nome, origem);
    if (diretorio === null || visitados.has(diretorio)) {
      continue;
    }
    visitados.add(diretorio);
    const pacote = JSON.parse(
      fs.readFileSync(path.join(diretorio, 'package.json'), 'utf8'),
    );
    if (pacote.type === 'module') {
      esm.add(nome);
    }
    for (const dependencia of Object.keys(pacote.dependencies ?? {})) {
      if (!dependencia.startsWith('@types/')) {
        pendentes.push({ nome: dependencia, origem: diretorio });
      }
    }
  }
  return [...esm];
}

/** @type {import('jest').Config} */
const configuracao = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^server-only$': '<rootDir>/tests/suporte/moduloVazio.ts',
  },
  clearMocks: true,
  // Cada derivação scrypt usa ~64 MiB; poucos workers evitam picos de memória.
  maxWorkers: 2,
};

const PADRAO_NODE_MODULES = '/node_modules/';
const INICIO_EXCECOES = '(?!(';

// O next/jest só deixa acrescentar padrões de exclusão; para transformar os
// pacotes ESM, eles entram na lista de exceções do padrão de node_modules
// (a mesma em que o Next põe os pacotes que ele próprio transpila).
export default async function montarConfiguracao() {
  const montada = await criarConfiguracaoJest(configuracao)();
  const pacotesEsm = listarPacotesEsm(PACOTES_MARKDOWN)
    .map((nome) => nome.replace(/[.+]/g, '\\$&'))
    .join('|');
  return {
    ...montada,
    transformIgnorePatterns: montada.transformIgnorePatterns.map((padrao) => {
      if (padrao === PADRAO_NODE_MODULES) {
        return `${PADRAO_NODE_MODULES}${INICIO_EXCECOES}${pacotesEsm})/)`;
      }
      return padrao.startsWith(PADRAO_NODE_MODULES) &&
        padrao.includes(INICIO_EXCECOES)
        ? padrao.replace(INICIO_EXCECOES, `${INICIO_EXCECOES}${pacotesEsm}|`)
        : padrao;
    }),
  };
}
