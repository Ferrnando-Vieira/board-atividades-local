import { loadEnvConfig } from '@next/env';
import fs from 'node:fs';
import path from 'node:path';
import { lerAmbiente, type Ambiente } from '@/config/ambiente';
import { abrirBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  contarMigracoesAplicadas,
  contarMigracoesDisponiveis,
} from '@/servidor/banco/migrador';
import { ehErroApp, ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const CODIGO_SAIDA_ERRO = 1;

type OpcoesAmbiente = {
  desenvolvimento?: boolean;
};

// Usa o mesmo carregador do Next para que scripts e servidor leiam os mesmos
// arquivos .env (.env, .env.local, .env.production...).
export function carregarAmbiente(opcoes: OpcoesAmbiente = {}): Ambiente {
  loadEnvConfig(process.cwd(), opcoes.desenvolvimento ?? false);
  return lerAmbiente();
}

// O npm roda o script na raiz do projeto; INIT_CWD guarda a pasta de onde o
// comando foi chamado, que é a referência de um caminho relativo digitado.
export function resolverCaminhoInformado(caminho: string): string {
  return path.resolve(process.env.INIT_CWD ?? process.cwd(), caminho);
}

export function abrirBancoInicializado(ambiente: Ambiente): BancoDados {
  if (!fs.existsSync(ambiente.caminhoBancoSqlite)) {
    throw new ErroApp(
      `Banco não encontrado em ${ambiente.caminhoBancoSqlite}. Execute "npm run inicializar".`,
      { status: STATUS_ERRO.CONFLITO, codigo: 'banco-ausente' },
    );
  }
  const banco = abrirBanco(ambiente.caminhoBancoSqlite, {
    exigirArquivoExistente: true,
  });
  if (contarMigracoesAplicadas(banco) < contarMigracoesDisponiveis()) {
    banco.$client.close();
    throw new ErroApp(
      'O banco tem migrações pendentes. Execute "npm run db:migrar" ou "npm run inicializar".',
      { status: STATUS_ERRO.CONFLITO, codigo: 'migracoes-pendentes' },
    );
  }
  return banco;
}

export function executarScript(tarefa: () => Promise<void> | void): void {
  Promise.resolve()
    .then(tarefa)
    .catch((erro: unknown) => {
      if (ehErroApp(erro)) {
        console.error(`Erro: ${erro.message}`);
      } else {
        console.error(erro);
      }
      process.exitCode = CODIGO_SAIDA_ERRO;
    });
}
