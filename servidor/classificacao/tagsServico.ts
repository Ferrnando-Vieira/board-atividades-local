import { and, count, eq, inArray, ne } from 'drizzle-orm';
import { CODIGO_CONFLITO_VERSAO } from '@/servidor/banco/concorrencia';
import type { BancoDados, ExecutorBanco } from '@/servidor/banco/conexao';
import {
  atividades,
  atividadesTags,
  escopoLinkTags,
  tags,
} from '@/servidor/banco/esquema';
import { incrementarVersaoAtividade } from '@/servidor/atividades/atividadesRepositorio';
import { exigirBoardPadrao } from '@/servidor/board/boardRepositorio';
import {
  garantirSolicitante,
  garantirTag,
} from '@/servidor/classificacao/classificacaoRepositorio';
import type {
  DadosExclusaoTag,
  DadosNovaTag,
  DadosEdicaoTag,
} from '@/servidor/classificacao/esquemasTags';
import { mensagensTags as mensagens } from '@/servidor/classificacao/mensagensTags';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import { gerarChaveNormalizada } from '@/util/NormalizacaoUtils';

const TRANSACAO_ESCRITA = { behavior: 'immediate' } as const;

export const CODIGO_TAG_INEXISTENTE = 'tag-inexistente';
export const CODIGO_NOME_TAG_REPETIDO = 'nome-tag-repetido';
export const CODIGO_TAG_COMPARTILHADA = 'tag-em-compartilhamento';

type TagRegistro = typeof tags.$inferSelect;

// Nome informado vira o id do solicitante (cadastrado se ainda não existe);
// nulo desfaz o vínculo.
function resolverSolicitantePadrao(
  executor: ExecutorBanco,
  boardId: number,
  nome: string | null,
): number | null {
  return nome === null ? null : garantirSolicitante(executor, boardId, nome).id;
}

function exigirTagComNome(
  executor: ExecutorBanco,
  boardId: number,
  tagId: number,
  nomeAtual: string,
): TagRegistro {
  const tag = executor
    .select()
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.boardId, boardId)))
    .get();
  if (!tag) {
    throw new ErroApp(mensagens.tagInexistente, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      codigo: CODIGO_TAG_INEXISTENTE,
    });
  }
  if (tag.nome !== nomeAtual) {
    throw new ErroApp(mensagens.tagAlterada, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGO_CONFLITO_VERSAO,
    });
  }
  return tag;
}

function erroNomeRepetido(): ErroApp {
  return new ErroApp(mensagens.nomeRepetido, {
    status: STATUS_ERRO.CONFLITO,
    codigo: CODIGO_NOME_TAG_REPETIDO,
  });
}

function listarAtividadesDaTag(
  executor: ExecutorBanco,
  tagId: number,
): number[] {
  return executor
    .select({ atividadeId: atividadesTags.atividadeId })
    .from(atividadesTags)
    .where(eq(atividadesTags.tagId, tagId))
    .all()
    .map((vinculo) => vinculo.atividadeId);
}

// Um formulário de atividade aberto antes da mudança reenviaria o nome antigo
// da tag e a recriaria; avançar a versão das atividades faz esse envio ser
// recusado como conflito.
function invalidarVersoesDasAtividades(
  executor: ExecutorBanco,
  idsAtividades: readonly number[],
): void {
  if (idsAtividades.length === 0) {
    return;
  }
  executor
    .update(atividades)
    .set({ versao: incrementarVersaoAtividade() })
    .where(inArray(atividades.id, [...idsAtividades]))
    .run();
}

export function criarTag(
  banco: BancoDados,
  dados: DadosNovaTag,
): { tagId: number } {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const tag = garantirTag(transacao, board.id, dados.nome);
    if (!tag.criado) {
      throw erroNomeRepetido();
    }
    const solicitantePadraoId = resolverSolicitantePadrao(
      transacao,
      board.id,
      dados.solicitantePadrao ?? null,
    );
    if (dados.cor || solicitantePadraoId !== null) {
      transacao
        .update(tags)
        .set({ cor: dados.cor ?? null, solicitantePadraoId })
        .where(eq(tags.id, tag.id))
        .run();
    }
    return { tagId: tag.id };
  }, TRANSACAO_ESCRITA);
}

// Trocar a cor ou o solicitante padrão não mexe nas atividades (o padrão só
// vale para as próximas gravações sem solicitante); trocar o nome invalida
// as versões das atividades da tag (ver invalidarVersoesDasAtividades).
export function editarTag(banco: BancoDados, dados: DadosEdicaoTag): void {
  banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = exigirTagComNome(
      transacao,
      board.id,
      dados.tagId,
      dados.nomeAtual,
    );
    if (dados.cor !== undefined && dados.cor !== atual.cor) {
      transacao
        .update(tags)
        .set({ cor: dados.cor })
        .where(eq(tags.id, atual.id))
        .run();
    }
    if (dados.solicitantePadrao !== undefined) {
      const solicitantePadraoId = resolverSolicitantePadrao(
        transacao,
        board.id,
        dados.solicitantePadrao,
      );
      if (solicitantePadraoId !== atual.solicitantePadraoId) {
        transacao
          .update(tags)
          .set({ solicitantePadraoId })
          .where(eq(tags.id, atual.id))
          .run();
      }
    }
    if (dados.nome === atual.nome) {
      return;
    }
    const nomeNormalizado = gerarChaveNormalizada(dados.nome);
    const repetida = transacao
      .select({ id: tags.id })
      .from(tags)
      .where(
        and(
          eq(tags.boardId, board.id),
          eq(tags.nomeNormalizado, nomeNormalizado),
          ne(tags.id, atual.id),
        ),
      )
      .get();
    if (repetida) {
      throw erroNomeRepetido();
    }
    transacao
      .update(tags)
      .set({ nome: dados.nome, nomeNormalizado })
      .where(eq(tags.id, atual.id))
      .run();
    invalidarVersoesDasAtividades(
      transacao,
      listarAtividadesDaTag(transacao, atual.id),
    );
  }, TRANSACAO_ESCRITA);
}

function exigirForaDeCompartilhamento(
  executor: ExecutorBanco,
  tagId: number,
): void {
  const vinculos =
    executor
      .select({ quantidade: count() })
      .from(escopoLinkTags)
      .where(eq(escopoLinkTags.tagId, tagId))
      .get()?.quantidade ?? 0;
  if (vinculos > 0) {
    throw new ErroApp(mensagens.usadaEmCompartilhamento, {
      status: STATUS_ERRO.CONFLITO,
      codigo: CODIGO_TAG_COMPARTILHADA,
    });
  }
}

// Remove só a tag e os vínculos N:N; as atividades continuam existindo.
export function excluirTag(
  banco: BancoDados,
  dados: DadosExclusaoTag,
): { atividadesAfetadas: number } {
  return banco.transaction((transacao) => {
    const board = exigirBoardPadrao(transacao);
    const atual = exigirTagComNome(
      transacao,
      board.id,
      dados.tagId,
      dados.nomeAtual,
    );
    exigirForaDeCompartilhamento(transacao, atual.id);
    const idsAtividades = listarAtividadesDaTag(transacao, atual.id);
    invalidarVersoesDasAtividades(transacao, idsAtividades);
    transacao
      .delete(atividadesTags)
      .where(eq(atividadesTags.tagId, atual.id))
      .run();
    transacao.delete(tags).where(eq(tags.id, atual.id)).run();
    return { atividadesAfetadas: idsAtividades.length };
  }, TRANSACAO_ESCRITA);
}
