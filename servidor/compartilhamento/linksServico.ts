import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { ehChaveAnimal, type ChaveAnimal } from '@/config/animais';
import type { ModalidadeCompartilhamento } from '@/config/constantes';
import { TOKEN_ALEATORIO_BYTES } from '@/config/constantesSeguranca';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import {
  escopoLinkSolicitantes,
  escopoLinkStatus,
  escopoLinkTags,
  linksCompartilhamento,
  solicitantes,
  tags,
} from '@/servidor/banco/esquema';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  derivarTokenLink,
  tokenDerivadoConfere,
} from '@/servidor/compartilhamento/chaveLinks';
import type {
  DadosAnimalLink,
  DadosEdicaoLink,
  DadosNovoLink,
  DadosReferenciaLink,
} from '@/servidor/compartilhamento/esquemasCompartilhamento';
import { mensagensCompartilhamento as mensagens } from '@/servidor/compartilhamento/mensagensCompartilhamento';
import {
  calcularHashToken,
  determinarSituacaoValidade,
  type SituacaoValidade,
} from '@/servidor/seguranca/tokens';
import { calcularExpiracaoEmDias } from '@/util/DataUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { compararTextos } from '@/util/NormalizacaoUtils';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

export const CODIGO_LINK_INEXISTENTE = 'link-inexistente';
export const CODIGO_ESCOPO_INEXISTENTE = 'escopo-inexistente';

const ORDEM_SITUACOES: Record<SituacaoValidade, number> = {
  ativo: 0,
  expirado: 1,
};

function erroLinkInexistente(): ErroApp {
  return new ErroApp(mensagens.linkInexistente, {
    status: STATUS_ERRO.NAO_ENCONTRADO,
    codigo: CODIGO_LINK_INEXISTENTE,
  });
}

export type LinkCriado = {
  linkId: number;
  token: string;
  expiraEm: string | null;
};

export type ItemEscopo = {
  id: number;
  nome: string;
};

export type LinkCompartilhamentoResumo = {
  id: number;
  nome: string;
  modalidade: ModalidadeCompartilhamento;
  padrao: boolean;
  incluirArquivadas: boolean;
  animal: ChaveAnimal | null;
  tags: ItemEscopo[];
  solicitantes: ItemEscopo[];
  criadoEm: string;
  expiraEm: string | null;
  ultimoAcessoEm: string | null;
  situacao: SituacaoValidade;
};

type TabelaEscopo = typeof tags | typeof solicitantes;

function exigirItensDoBoard(
  executor: ExecutorBanco,
  tabela: TabelaEscopo,
  boardId: number,
  identificadores: readonly number[],
  mensagem: string,
): void {
  if (identificadores.length === 0) {
    return;
  }
  const encontrados = executor
    .select({ id: tabela.id })
    .from(tabela)
    .where(
      and(
        eq(tabela.boardId, boardId),
        inArray(tabela.id, [...identificadores]),
      ),
    )
    .all();
  if (encontrados.length !== identificadores.length) {
    throw new ErroApp(mensagem, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGO_ESCOPO_INEXISTENTE,
    });
  }
}

type EscopoLink = Pick<DadosNovoLink, 'tagIds' | 'solicitanteIds'>;

function exigirEscopoDoBoard(
  executor: ExecutorBanco,
  boardId: number,
  escopo: EscopoLink,
): void {
  exigirItensDoBoard(
    executor,
    tags,
    boardId,
    escopo.tagIds,
    mensagens.tagInexistente,
  );
  exigirItensDoBoard(
    executor,
    solicitantes,
    boardId,
    escopo.solicitanteIds,
    mensagens.solicitanteInexistente,
  );
}

function gravarEscopo(
  executor: ExecutorBanco,
  linkId: number,
  escopo: EscopoLink,
): void {
  if (escopo.tagIds.length > 0) {
    executor
      .insert(escopoLinkTags)
      .values(escopo.tagIds.map((tagId) => ({ linkId, tagId })))
      .run();
  }
  if (escopo.solicitanteIds.length > 0) {
    executor
      .insert(escopoLinkSolicitantes)
      .values(
        escopo.solicitanteIds.map((solicitanteId) => ({
          linkId,
          solicitanteId,
        })),
      )
      .run();
  }
}

function apagarEscopo(executor: ExecutorBanco, linkId: number): void {
  executor
    .delete(escopoLinkTags)
    .where(eq(escopoLinkTags.linkId, linkId))
    .run();
  executor
    .delete(escopoLinkSolicitantes)
    .where(eq(escopoLinkSolicitantes.linkId, linkId))
    .run();
  executor
    .delete(escopoLinkStatus)
    .where(eq(escopoLinkStatus.linkId, linkId))
    .run();
}

function gravarTokenDerivado(
  executor: ExecutorBanco,
  linkId: number,
  chave: Buffer,
): string {
  const token = derivarTokenLink(chave, { id: linkId, padrao: false });
  executor
    .update(linksCompartilhamento)
    .set({ hashToken: calcularHashToken(token) })
    .where(eq(linksCompartilhamento.id, linkId))
    .run();
  return token;
}

// O token é derivado da chave dos links e do id, que só existe depois da
// inserção: o hash provisório (de bytes aleatórios) não sai da transação.
export function criarLinkCompartilhamento(
  banco: BancoDados,
  dados: DadosNovoLink,
  chave: Buffer,
  agora: Date = new Date(),
): LinkCriado {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    exigirEscopoDoBoard(transacao, board.id, dados);
    const expiraEm = calcularExpiracaoEmDias(agora, dados.validadeDias);
    const link = transacao
      .insert(linksCompartilhamento)
      .values({
        boardId: board.id,
        nome: dados.nome,
        modalidade: dados.modalidade,
        hashToken: calcularHashToken(
          randomBytes(TOKEN_ALEATORIO_BYTES).toString('base64url'),
        ),
        incluirArquivadas: dados.incluirArquivadas,
        expiraEm,
        animal: dados.animal,
        criadoEm: agora.toISOString(),
      })
      .returning({ id: linksCompartilhamento.id })
      .get();
    gravarEscopo(transacao, link.id, dados);
    const token = gravarTokenDerivado(transacao, link.id, chave);
    return { linkId: link.id, token, expiraEm };
  }, TRANSACAO_ESCRITA);
}

function buscarLinkNomeadoAtivo(
  executor: ExecutorBanco,
  boardId: number,
  linkId: number,
) {
  const link = executor
    .select({
      id: linksCompartilhamento.id,
      expiraEm: linksCompartilhamento.expiraEm,
      hashToken: linksCompartilhamento.hashToken,
    })
    .from(linksCompartilhamento)
    .where(
      and(
        eq(linksCompartilhamento.id, linkId),
        eq(linksCompartilhamento.boardId, boardId),
        eq(linksCompartilhamento.padrao, false),
        isNull(linksCompartilhamento.revogadoEm),
      ),
    )
    .get();
  if (!link) {
    throw erroLinkInexistente();
  }
  return link;
}

// O endereço continua o mesmo: quem já tem o link passa a ver o novo escopo
// na próxima requisição. Validade omitida mantém a atual.
export function editarLinkCompartilhamento(
  banco: BancoDados,
  dados: DadosEdicaoLink,
  agora: Date = new Date(),
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = buscarLinkNomeadoAtivo(transacao, board.id, dados.linkId);
    exigirEscopoDoBoard(transacao, board.id, dados);
    transacao
      .update(linksCompartilhamento)
      .set({
        nome: dados.nome,
        modalidade: dados.modalidade,
        incluirArquivadas: dados.incluirArquivadas,
        expiraEm:
          dados.validadeDias === undefined
            ? atual.expiraEm
            : calcularExpiracaoEmDias(agora, dados.validadeDias),
        atualizadoEm: agora.toISOString(),
        versao: sql`${linksCompartilhamento.versao} + 1`,
      })
      .where(eq(linksCompartilhamento.id, atual.id))
      .run();
    apagarEscopo(transacao, atual.id);
    gravarEscopo(transacao, atual.id, dados);
  }, TRANSACAO_ESCRITA);
}

// Para links gravados antes da derivação (ou depois de trocada a chave): o
// endereço passa a ser o derivado, e o antigo deixa de funcionar.
export function tornarEnderecoCopiavel(
  banco: BancoDados,
  dados: DadosReferenciaLink,
  chave: Buffer,
): string {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const link = buscarLinkNomeadoAtivo(transacao, board.id, dados.linkId);
    return tokenDerivadoConfere(chave, { ...link, padrao: false })
      ? derivarTokenLink(chave, { id: link.id, padrao: false })
      : gravarTokenDerivado(transacao, link.id, chave);
  }, TRANSACAO_ESCRITA);
}

// Só dos links nomeados ainda não revogados cujo hash confere com a chave
// atual; os demais não têm endereço reconstruível.
export function consultarTokensLinks(
  executor: ExecutorBanco,
  boardId: number,
  chave: Buffer,
): Map<number, string> {
  const links = executor
    .select({
      id: linksCompartilhamento.id,
      hashToken: linksCompartilhamento.hashToken,
    })
    .from(linksCompartilhamento)
    .where(
      and(
        eq(linksCompartilhamento.boardId, boardId),
        eq(linksCompartilhamento.padrao, false),
        isNull(linksCompartilhamento.revogadoEm),
      ),
    )
    .all();
  return new Map(
    links.flatMap((link) => {
      const derivavel = { ...link, padrao: false };
      return tokenDerivadoConfere(chave, derivavel)
        ? [[link.id, derivarTokenLink(chave, derivavel)] as const]
        : [];
    }),
  );
}

function agruparPorLink(
  linhas: readonly (ItemEscopo & { linkId: number })[],
): Map<number, ItemEscopo[]> {
  const grupos = new Map<number, ItemEscopo[]>();
  for (const { linkId, id, nome } of linhas) {
    const lista = grupos.get(linkId) ?? [];
    lista.push({ id, nome });
    grupos.set(linkId, lista);
  }
  for (const lista of grupos.values()) {
    lista.sort((primeiro, segundo) =>
      compararTextos(primeiro.nome, segundo.nome),
    );
  }
  return grupos;
}

function listarTagsDosLinks(executor: ExecutorBanco, linkIds: number[]) {
  return agruparPorLink(
    executor
      .select({ linkId: escopoLinkTags.linkId, id: tags.id, nome: tags.nome })
      .from(escopoLinkTags)
      .innerJoin(tags, eq(tags.id, escopoLinkTags.tagId))
      .where(inArray(escopoLinkTags.linkId, linkIds))
      .all(),
  );
}

function listarSolicitantesDosLinks(
  executor: ExecutorBanco,
  linkIds: number[],
) {
  return agruparPorLink(
    executor
      .select({
        linkId: escopoLinkSolicitantes.linkId,
        id: solicitantes.id,
        nome: solicitantes.nome,
      })
      .from(escopoLinkSolicitantes)
      .innerJoin(
        solicitantes,
        eq(solicitantes.id, escopoLinkSolicitantes.solicitanteId),
      )
      .where(inArray(escopoLinkSolicitantes.linkId, linkIds))
      .all(),
  );
}

// Revogados ficam só no banco: a listagem traz os ativos e os expirados, e o
// hash nunca sai daqui.
export function listarLinksCompartilhamento(
  executor: ExecutorBanco,
  boardId: number,
  agora: Date = new Date(),
): LinkCompartilhamentoResumo[] {
  const links = executor
    .select({
      id: linksCompartilhamento.id,
      nome: linksCompartilhamento.nome,
      modalidade: linksCompartilhamento.modalidade,
      padrao: linksCompartilhamento.padrao,
      incluirArquivadas: linksCompartilhamento.incluirArquivadas,
      animal: linksCompartilhamento.animal,
      criadoEm: linksCompartilhamento.criadoEm,
      expiraEm: linksCompartilhamento.expiraEm,
      ultimoAcessoEm: linksCompartilhamento.ultimoAcessoEm,
    })
    .from(linksCompartilhamento)
    .where(
      and(
        eq(linksCompartilhamento.boardId, boardId),
        isNull(linksCompartilhamento.revogadoEm),
      ),
    )
    .orderBy(
      desc(linksCompartilhamento.criadoEm),
      desc(linksCompartilhamento.id),
    )
    .all();
  if (links.length === 0) {
    return [];
  }
  const linkIds = links.map((link) => link.id);
  const tagsPorLink = listarTagsDosLinks(executor, linkIds);
  const solicitantesPorLink = listarSolicitantesDosLinks(executor, linkIds);
  return links
    .map((link) => ({
      ...link,
      animal: ehChaveAnimal(link.animal) ? link.animal : null,
      tags: tagsPorLink.get(link.id) ?? [],
      solicitantes: solicitantesPorLink.get(link.id) ?? [],
      situacao: determinarSituacaoValidade(link.expiraEm, agora),
    }))
    .sort(
      (primeiro, segundo) =>
        ORDEM_SITUACOES[primeiro.situacao] - ORDEM_SITUACOES[segundo.situacao],
    );
}

// Só links ativos (não revogados) e que não sejam o padrão: o padrão é o
// acesso anônimo e continua sorteando um animal por visitante.
export function definirAnimalLink(
  banco: BancoDados,
  dados: DadosAnimalLink,
  agora: Date = new Date(),
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atualizado = transacao
      .update(linksCompartilhamento)
      .set({
        animal: dados.animal,
        atualizadoEm: agora.toISOString(),
        versao: sql`${linksCompartilhamento.versao} + 1`,
      })
      .where(
        and(
          eq(linksCompartilhamento.id, dados.linkId),
          eq(linksCompartilhamento.boardId, board.id),
          eq(linksCompartilhamento.padrao, false),
          isNull(linksCompartilhamento.revogadoEm),
        ),
      )
      .returning({ id: linksCompartilhamento.id })
      .get();
    if (!atualizado) {
      throw erroLinkInexistente();
    }
  }, TRANSACAO_ESCRITA);
}

// O escopo sai junto: o link revogado nunca mais concede acesso, e manter as
// linhas bloquearia (RESTRICT) a exclusão das tags e status que ele citava.
export function revogarLinkCompartilhamento(
  banco: BancoDados,
  dados: DadosReferenciaLink,
  agora: Date = new Date(),
): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const link = transacao
      .select({
        id: linksCompartilhamento.id,
        revogadoEm: linksCompartilhamento.revogadoEm,
      })
      .from(linksCompartilhamento)
      .where(
        and(
          eq(linksCompartilhamento.id, dados.linkId),
          eq(linksCompartilhamento.boardId, board.id),
        ),
      )
      .get();
    if (!link) {
      throw erroLinkInexistente();
    }
    if (link.revogadoEm === null) {
      transacao
        .update(linksCompartilhamento)
        .set({
          revogadoEm: agora.toISOString(),
          versao: sql`${linksCompartilhamento.versao} + 1`,
        })
        .where(eq(linksCompartilhamento.id, link.id))
        .run();
    }
    apagarEscopo(transacao, link.id);
  }, TRANSACAO_ESCRITA);
}
