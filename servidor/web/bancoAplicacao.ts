import 'server-only';
import fs from 'node:fs';
import { obterAmbiente } from '@/config/ambiente';
import { abrirBanco, type BancoDados } from '@/servidor/banco/conexao';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const CHAVE_GLOBAL_BANCO = '__boardAtividadesBanco';

export const CODIGO_BANCO_AUSENTE = 'banco-ausente';

type GlobalComBanco = typeof globalThis & {
  [CHAVE_GLOBAL_BANCO]?: BancoDados;
};

function abrirBancoExistente(caminho: string): BancoDados {
  if (!fs.existsSync(caminho)) {
    throw new ErroApp(
      'Banco de dados não encontrado. Execute "npm run inicializar".',
      { status: STATUS_ERRO.INTERNO, codigo: CODIGO_BANCO_AUSENTE },
    );
  }
  return abrirBanco(caminho, { exigirArquivoExistente: true });
}

// `next dev` reavalia módulos a cada edição; guardar a conexão em globalThis
// evita abrir um novo handle do SQLite a cada recarga. O servidor web nunca
// cria o arquivo do banco: isso é papel de `npm run inicializar`.
export function obterBancoAplicacao(): BancoDados {
  const escopoGlobal = globalThis as GlobalComBanco;
  escopoGlobal[CHAVE_GLOBAL_BANCO] ??= abrirBancoExistente(
    obterAmbiente().caminhoBancoSqlite,
  );
  return escopoGlobal[CHAVE_GLOBAL_BANCO];
}
