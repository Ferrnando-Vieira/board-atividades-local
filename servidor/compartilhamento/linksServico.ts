import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ehChaveAnimal, type ChaveAnimal } from '@/config/animais';
import type { ModalidadeCompartilhamento } from '@/config/constantes';
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
import type {
  DadosAnimalLink,
  DadosNovoLink,
  DadosRevogacaoLink,
} from '@/servidor/compartilhamento/esquemasCompartilhamento';
import { mensagensCompartilhamento as mensagens } from '@/servidor/compartilhamento/mensagensCompartilhamento';
import {
  calcularHashToken,
  determinarSituacaoCredencial,
  gerarTokenSeguro,
  type SituacaoCredencial,
} from '@/servidor/seguranca/tokens';
import { calcularExpiracaoEmDias } from '@/util/DataUtils';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { compararTextos } from '@/util/NormalizacaoUtils';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

export const CODIGO_LINK_INEXISTENTE = 'link-inexistente';
export const CODIGO_ESCOPO_INEXISTENTE = 'escopo-inexistente';

const ORDEM_SITUACOES: Record<SituacaoCredencial, number> = {
  ativo: 0,
  expirado: 1,
  revogado: 2,
};

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
  revogadoEm: string | null;
  ultimoAcessoEm: string | null;
  situacao: SituacaoCredencial;
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

// O token só existe na resposta desta função: o banco guarda o SHA-256, e o
// endereço completo não pode ser exibido de novo depois.
export function criarLinkCompartilhamento(
  banco: BancoDados,
  dados: DadosNovoLink,
  agora: Date = new Date(),
): LinkCriado {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    exigirItensDoBoard(
      transacao,
      tags,
      board.id,
      dados.tagIds,
      mensagens.tagInexistente,
    );
    exigirItensDoBoard(
      transacao,
      solicitantes,
      board.id,
      dados.solicitanteIds,
      mensagens.solicitanteInexistente,
    );
    const token = gerarTokenSeguro();
    const expiraEm = calcularExpiracaoEmDias(agora, dados.validadeDias);
    const link = transacao
      .insert(linksCompartilhamento)
      .values({
        boardId: board.id,
        nome: dados.nome,
        modalidade: dados.modalidade,
        hashToken: calcularHashToken(token),
        incluirArquivadas: dados.incluirArquivadas,
        expiraEm,
        animal: dados.animal,
        criadoEm: agora.toISOString(),
      })
      .returning({ id: linksCompartilhamento.id })
      .get();
    if (dados.tagIds.length > 0) {
      transacao
        .insert(escopoLinkTags)
        .values(dados.tagIds.map((tagId) => ({ linkId: link.id, tagId })))
        .run();
    }
    if (dados.solicitanteIds.length > 0) {
      transacao
        .insert(escopoLinkSolicitantes)
        .values(
          dados.solicitanteIds.map((solicitanteId) => ({
            linkId: link.id,
            solicitanteId,
          })),
        )
        .run();
    }
    return { linkId: link.id, token, expiraEm };
  }, TRANSACAO_ESCRITA);
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

// O hash nunca sai daqui: a listagem seleciona só as colunas exibidas.
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
      revogadoEm: linksCompartilhamento.revogadoEm,
      ultimoAcessoEm: linksCompartilhamento.ultimoAcessoEm,
    })
    .from(linksCompartilhamento)
    .where(eq(linksCompartilhamento.boardId, boardId))
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
      situacao: determinarSituacaoCredencial(
        link.revogadoEm,
        link.expiraEm,
        agora,
      ),
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
      throw new ErroApp(mensagens.linkInexistente, {
        status: STATUS_ERRO.NAO_ENCONTRADO,
        codigo: CODIGO_LINK_INEXISTENTE,
      });
    }
  }, TRANSACAO_ESCRITA);
}

// O escopo sai junto: o link revogado nunca mais concede acesso, e manter as
// linhas bloquearia (RESTRICT) a exclusão das tags e status que ele citava.
export function revogarLinkCompartilhamento(
  banco: BancoDados,
  dados: DadosRevogacaoLink,
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
      throw new ErroApp(mensagens.linkInexistente, {
        status: STATUS_ERRO.NAO_ENCONTRADO,
        codigo: CODIGO_LINK_INEXISTENTE,
      });
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
    transacao
      .delete(escopoLinkTags)
      .where(eq(escopoLinkTags.linkId, link.id))
      .run();
    transacao
      .delete(escopoLinkSolicitantes)
      .where(eq(escopoLinkSolicitantes.linkId, link.id))
      .run();
    transacao
      .delete(escopoLinkStatus)
      .where(eq(escopoLinkStatus.linkId, link.id))
      .run();
  }, TRANSACAO_ESCRITA);
}
