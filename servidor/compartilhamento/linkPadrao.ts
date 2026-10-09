import { and, eq, isNull, sql } from 'drizzle-orm';
import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TOKEN_ALEATORIO_BYTES } from '@/config/constantesSeguranca';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { linksCompartilhamento } from '@/servidor/banco/esquema';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  calcularHashToken,
  gerarTokenSeguro,
  hashesIguais,
} from '@/servidor/seguranca/tokens';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;
const NOME_ARQUIVO_CHAVE = 'chave-link-padrao';
const CRIACAO_EXCLUSIVA = 'wx';
const SOBRESCRITA = 'w';
const PERMISSAO_SOMENTE_DONO = 0o600;
const CODIGO_ARQUIVO_EXISTENTE = 'EEXIST';
const CODIGO_ARQUIVO_AUSENTE = 'ENOENT';
const CONTEXTO_DERIVACAO = 'board-atividades:link-padrao:';
const ALGORITMO_DERIVACAO = 'sha256';
const FORMATO_CHAVE = /^[A-Za-z0-9_-]{43}$/;

export const NOME_LINK_PADRAO = 'Link padrão de visualização';

export type LinkPadrao = {
  linkId: number;
  token: string;
  criado: boolean;
};

function ehErroDeSistema(erro: unknown, codigo: string): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    erro.code === codigo
  );
}

// A chave fica num arquivo ao lado do banco, fora dele: uma cópia só do
// SQLite (um backup, por exemplo) guarda apenas o hash do token, como nos
// demais links, e não permite reconstruir o endereço.
export function resolverCaminhoChaveLinkPadrao(caminhoBanco: string): string {
  return path.join(path.dirname(caminhoBanco), NOME_ARQUIVO_CHAVE);
}

// Conteúdo fora do formato vale como chave ausente: o arquivo é regravado na
// próxima criação, e o link derivado da chave antiga deixa de conferir.
export function lerChaveLinkPadrao(caminho: string): Buffer | null {
  let conteudo: string;
  try {
    conteudo = fs.readFileSync(/*turbopackIgnore: true*/ caminho, 'utf8');
  } catch (erro) {
    if (ehErroDeSistema(erro, CODIGO_ARQUIVO_AUSENTE)) {
      return null;
    }
    throw erro;
  }
  const texto = conteudo.trim();
  return FORMATO_CHAVE.test(texto) ? Buffer.from(texto, 'base64url') : null;
}

// Arquivo ausente usa criação exclusiva ('wx'): se dois processos tentarem
// ao mesmo tempo, o segundo lê a chave do primeiro em vez de sobrescrevê-la.
export function obterOuCriarChaveLinkPadrao(caminho: string): Buffer {
  const existente = lerChaveLinkPadrao(caminho);
  if (existente) {
    return existente;
  }
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(caminho), {
    recursive: true,
  });
  const modo = fs.existsSync(/*turbopackIgnore: true*/ caminho)
    ? SOBRESCRITA
    : CRIACAO_EXCLUSIVA;
  try {
    fs.writeFileSync(
      /*turbopackIgnore: true*/ caminho,
      gerarTokenSeguro(TOKEN_ALEATORIO_BYTES),
      { flag: modo, mode: PERMISSAO_SOMENTE_DONO },
    );
  } catch (erro) {
    if (!ehErroDeSistema(erro, CODIGO_ARQUIVO_EXISTENTE)) {
      throw erro;
    }
  }
  const chave = lerChaveLinkPadrao(caminho);
  if (!chave) {
    throw new Error(
      `Não foi possível gravar a chave do link padrão em ${caminho}.`,
    );
  }
  return chave;
}

// HMAC com chave aleatória de 256 bits: o token tem o mesmo tamanho e a
// mesma imprevisibilidade dos demais links e pode ser recalculado para exibir
// o endereço, sem que o banco guarde o token em si.
export function derivarTokenLinkPadrao(chave: Buffer, linkId: number): string {
  return createHmac(ALGORITMO_DERIVACAO, chave)
    .update(`${CONTEXTO_DERIVACAO}${linkId}`)
    .digest('base64url');
}

function buscarLinkPadraoAtivo(executor: ExecutorBanco, boardId: number) {
  return executor
    .select({
      id: linksCompartilhamento.id,
      hashToken: linksCompartilhamento.hashToken,
    })
    .from(linksCompartilhamento)
    .where(
      and(
        eq(linksCompartilhamento.boardId, boardId),
        eq(linksCompartilhamento.padrao, true),
        isNull(linksCompartilhamento.revogadoEm),
      ),
    )
    .get();
}

function tokenConfere(
  chave: Buffer,
  link: { id: number; hashToken: string },
): boolean {
  return hashesIguais(
    link.hashToken,
    calcularHashToken(derivarTokenLinkPadrao(chave, link.id)),
  );
}

// Só leitura: devolve o token do link padrão ativo se ele ainda corresponder
// à chave atual; caso contrário, o endereço não pode ser exibido.
export function consultarLinkPadrao(
  executor: ExecutorBanco,
  boardId: number,
  chave: Buffer,
): Omit<LinkPadrao, 'criado'> | null {
  const link = buscarLinkPadraoAtivo(executor, boardId);
  if (!link || !tokenConfere(chave, link)) {
    return null;
  }
  return { linkId: link.id, token: derivarTokenLinkPadrao(chave, link.id) };
}

// O link padrão nunca tem linhas de escopo (vale o board inteiro), então
// revogar é só marcar o momento.
function revogarNaTransacao(
  transacao: ExecutorBanco,
  linkId: number,
  agora: Date,
): void {
  transacao
    .update(linksCompartilhamento)
    .set({
      revogadoEm: agora.toISOString(),
      versao: sql`${linksCompartilhamento.versao} + 1`,
    })
    .where(eq(linksCompartilhamento.id, linkId))
    .run();
}

// O hash provisório (de bytes aleatórios) só existe dentro da transação: o
// token depende do id, que só é conhecido depois da inserção.
function criarNaTransacao(
  transacao: ExecutorBanco,
  boardId: number,
  chave: Buffer,
  agora: Date,
): LinkPadrao {
  const link = transacao
    .insert(linksCompartilhamento)
    .values({
      boardId,
      nome: NOME_LINK_PADRAO,
      modalidade: 'restrito',
      padrao: true,
      incluirArquivadas: false,
      hashToken: calcularHashToken(
        randomBytes(TOKEN_ALEATORIO_BYTES).toString('base64url'),
      ),
      criadoEm: agora.toISOString(),
    })
    .returning({ id: linksCompartilhamento.id })
    .get();
  const token = derivarTokenLinkPadrao(chave, link.id);
  transacao
    .update(linksCompartilhamento)
    .set({ hashToken: calcularHashToken(token) })
    .where(eq(linksCompartilhamento.id, link.id))
    .run();
  return { linkId: link.id, token, criado: true };
}

// Chamada na inicialização do servidor e pelo botão de ativação: reaproveita
// o link padrão ativo e só cria outro se não houver um válido. Se a chave
// mudou (arquivo apagado ou banco restaurado sem ele), o endereço antigo não
// pode mais ser reconstruído e o link é revogado antes de criar o novo.
export function garantirLinkPadrao(
  banco: BancoDados,
  chave: Buffer,
  agora: Date = new Date(),
): LinkPadrao {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const existente = buscarLinkPadraoAtivo(transacao, board.id);
    if (existente && tokenConfere(chave, existente)) {
      return {
        linkId: existente.id,
        token: derivarTokenLinkPadrao(chave, existente.id),
        criado: false,
      };
    }
    if (existente) {
      revogarNaTransacao(transacao, existente.id, agora);
    }
    return criarNaTransacao(transacao, board.id, chave, agora);
  }, TRANSACAO_ESCRITA);
}

// Gera um endereço novo: o anterior para de funcionar na mesma transação.
export function renovarLinkPadrao(
  banco: BancoDados,
  chave: Buffer,
  agora: Date = new Date(),
): LinkPadrao {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const existente = buscarLinkPadraoAtivo(transacao, board.id);
    if (existente) {
      revogarNaTransacao(transacao, existente.id, agora);
    }
    return criarNaTransacao(transacao, board.id, chave, agora);
  }, TRANSACAO_ESCRITA);
}
