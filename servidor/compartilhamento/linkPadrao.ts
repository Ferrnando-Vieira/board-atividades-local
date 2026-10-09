import { and, eq, isNull, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { TOKEN_ALEATORIO_BYTES } from '@/config/constantesSeguranca';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import { linksCompartilhamento } from '@/servidor/banco/esquema';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  derivarTokenLink,
  tokenDerivadoConfere,
} from '@/servidor/compartilhamento/chaveLinks';
import { calcularHashToken } from '@/servidor/seguranca/tokens';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

export const NOME_LINK_PADRAO = 'Link padrão de visualização';

export type LinkPadrao = {
  linkId: number;
  token: string;
  criado: boolean;
};

function derivarTokenPadrao(chave: Buffer, linkId: number): string {
  return derivarTokenLink(chave, { id: linkId, padrao: true });
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
  return tokenDerivadoConfere(chave, { ...link, padrao: true });
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
  return { linkId: link.id, token: derivarTokenPadrao(chave, link.id) };
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
  const token = derivarTokenPadrao(chave, link.id);
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
        token: derivarTokenPadrao(chave, existente.id),
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
