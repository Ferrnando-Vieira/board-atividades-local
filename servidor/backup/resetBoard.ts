import fs from 'node:fs';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

// O -wal e o -shm andam com o banco: um -wal esquecido seria aplicado sobre o
// banco novo e o corromperia.
const SUFIXOS_ARQUIVOS_BANCO = ['', '-wal', '-shm'] as const;
const CODIGOS_ARQUIVO_EM_USO = new Set(['EBUSY', 'EPERM', 'EACCES']);

export const CODIGO_BANCO_EM_USO_RESET = 'banco-em-uso';

export const MENSAGEM_BANCO_EM_USO_RESET =
  'O banco está em uso. Pare o servidor (e o MCP) e execute o reset de novo; nada foi apagado.';

export type OpcoesResetBoard = {
  caminhoBanco: string;
  diretorioAnexos: string;
  caminhoChaveLinks: string;
  agora?: Date;
};

type Movimento = { de: string; para: string };

export function listarAlvosReset(opcoes: OpcoesResetBoard): string[] {
  return [
    ...SUFIXOS_ARQUIVOS_BANCO.map(
      (sufixo) => `${opcoes.caminhoBanco}${sufixo}`,
    ),
    opcoes.diretorioAnexos,
    opcoes.caminhoChaveLinks,
  ];
}

function lerCodigoErro(erro: unknown): string | undefined {
  return typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    typeof erro.code === 'string'
    ? erro.code
    : undefined;
}

function desfazer(movimentos: readonly Movimento[]): void {
  for (const movimento of [...movimentos].reverse()) {
    fs.renameSync(movimento.para, movimento.de);
  }
}

// Volta o board ao estado de fábrica: banco, anexos (com as imagens de fundo)
// e a chave dos links de compartilhamento. Primeiro tudo é renomeado ao lado do original; no
// Windows o banco aberto pelo servidor não pode ser renomeado, então com o
// servidor no ar o que já andou volta e nada é apagado. Só depois os itens
// renomeados são removidos. Devolve os caminhos que existiam e foram apagados.
export function apagarDadosBoard(opcoes: OpcoesResetBoard): string[] {
  const carimbo = (opcoes.agora ?? new Date())
    .toISOString()
    .replace(/[:.]/g, '-');
  const movimentos: Movimento[] = [];
  try {
    for (const alvo of listarAlvosReset(opcoes)) {
      if (fs.existsSync(alvo)) {
        const movimento = { de: alvo, para: `${alvo}.resetando-${carimbo}` };
        fs.renameSync(movimento.de, movimento.para);
        movimentos.push(movimento);
      }
    }
  } catch (erro) {
    desfazer(movimentos);
    const codigo = lerCodigoErro(erro);
    if (codigo !== undefined && CODIGOS_ARQUIVO_EM_USO.has(codigo)) {
      throw new ErroApp(MENSAGEM_BANCO_EM_USO_RESET, {
        status: STATUS_ERRO.CONFLITO,
        codigo: CODIGO_BANCO_EM_USO_RESET,
      });
    }
    throw erro;
  }
  for (const movimento of movimentos) {
    fs.rmSync(movimento.para, { recursive: true, force: true });
  }
  return movimentos.map((movimento) => movimento.de);
}
