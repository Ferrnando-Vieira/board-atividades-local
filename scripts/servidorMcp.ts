import { loadEnvConfig } from '@next/env';
import path from 'node:path';
import readline from 'node:readline';
import { PREFIXO_API } from '@/config/rotas';
import {
  executarFerramenta,
  FERRAMENTAS_MCP,
} from '@/servidor/mcp/ferramentasMcp';
import { criarServidorMcp } from '@/servidor/mcp/protocoloMcp';
import { textosMcp } from '@/servidor/mcp/textosMcp';
import pacote from '../package.json';

const NOME_SERVIDOR = 'board-atividades';
const PORTA_PADRAO = '3000';
const ENDERECO_LOCAL = 'http://127.0.0.1';

// Servidor MCP por stdio: o cliente (Claude Code, Kiro…) o inicia e conversa
// por linhas JSON no stdin/stdout. Ele só usa a API HTTP do board, nunca o
// SQLite. O stdout é exclusivo do protocolo: qualquer log vai para o stderr.
const raizProjeto = path.resolve(__dirname, '..');
loadEnvConfig(raizProjeto, false, {
  info: () => undefined,
  error: (...mensagens: unknown[]) => console.error(...mensagens),
});

const urlApi =
  process.env.BOARD_API_URL?.trim() ||
  `${ENDERECO_LOCAL}:${process.env.PORTA?.trim() || PORTA_PADRAO}${PREFIXO_API}`;
const token = process.env.BOARD_API_TOKEN?.trim() || null;

if (!token) {
  console.error(textosMcp.tokenAusente);
}

const servidor = criarServidorMcp({
  nome: NOME_SERVIDOR,
  titulo: textosMcp.titulo,
  versao: pacote.version,
  instrucoes: textosMcp.instrucoes,
  ferramentas: FERRAMENTAS_MCP,
  executar: (nome, argumentos) =>
    executarFerramenta({ urlApi, token }, nome, argumentos),
});

const entrada = readline.createInterface({ input: process.stdin });
const pendentes = new Set<Promise<void>>();

entrada.on('line', (linha) => {
  const tarefa: Promise<void> = servidor
    .processarLinha(linha)
    .then((resposta) => {
      if (resposta !== null) {
        process.stdout.write(`${resposta}\n`);
      }
    })
    .catch((erro: unknown) => console.error(erro))
    .finally(() => pendentes.delete(tarefa));
  pendentes.add(tarefa);
});

// O cliente encerra o servidor fechando o stdin; respostas ainda em
// andamento terminam antes da saída.
entrada.on('close', () => {
  void Promise.allSettled([...pendentes]).then(() => process.exit(0));
});
