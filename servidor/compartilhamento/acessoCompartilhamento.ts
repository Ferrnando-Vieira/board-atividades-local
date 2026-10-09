import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { ehChaveAnimal, type ChaveAnimal } from '@/config/animais';
import type { ModalidadeCompartilhamento } from '@/config/constantes';
import {
  COMPARTILHAMENTO,
  TAMANHO_TOKEN_ALEATORIO,
} from '@/config/constantesSeguranca';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import {
  escopoLinkSolicitantes,
  escopoLinkStatus,
  escopoLinkTags,
  linksCompartilhamento,
} from '@/servidor/banco/esquema';
import {
  criarFiltroAtividades,
  type FiltroAtividades,
} from '@/servidor/atividades/filtrosAtividades';
import { buscarBoardPadrao } from '@/servidor/board/boardRepositorio';
import { calcularHashToken } from '@/servidor/seguranca/tokens';
import { somarMinutos } from '@/util/DataUtils';

const FORMATO_TOKEN_COMPARTILHAMENTO = new RegExp(
  `^[A-Za-z0-9_-]{${TAMANHO_TOKEN_ALEATORIO}}$`,
);

export type LinkValidado = {
  linkId: number;
  nome: string;
  modalidade: ModalidadeCompartilhamento;
  incluirArquivadas: boolean;
  expiraEm: string | null;
  // null somente no link completo, que vê o board inteiro.
  restricao: FiltroAtividades | null;
  padrao: boolean;
  // Animal fixo de quem entra pelo link; null = sorteado.
  animal: ChaveAnimal | null;
};

type LinkGravado = {
  id: number;
  nome: string;
  modalidade: ModalidadeCompartilhamento;
  incluirArquivadas: boolean;
  prioridadeMinima: number | null;
  prioridadeMaxima: number | null;
  expiraEm: string | null;
  padrao: boolean;
  animal: string | null;
};

export function ehFormatoTokenCompartilhamento(
  token: unknown,
): token is string {
  return (
    typeof token === 'string' && FORMATO_TOKEN_COMPARTILHAMENTO.test(token)
  );
}

function listarIdsDoEscopo(executor: ExecutorBanco, linkId: number) {
  return {
    tagIds: executor
      .select({ id: escopoLinkTags.tagId })
      .from(escopoLinkTags)
      .where(eq(escopoLinkTags.linkId, linkId))
      .all()
      .map((linha) => linha.id),
    solicitanteIds: executor
      .select({ id: escopoLinkSolicitantes.solicitanteId })
      .from(escopoLinkSolicitantes)
      .where(eq(escopoLinkSolicitantes.linkId, linkId))
      .all()
      .map((linha) => linha.id),
    statusIds: executor
      .select({ id: escopoLinkStatus.statusId })
      .from(escopoLinkStatus)
      .where(eq(escopoLinkStatus.linkId, linkId))
      .all()
      .map((linha) => linha.id),
  };
}

// Um link restrito sem tag nem solicitante não pode virar acesso irrestrito
// (grupo vazio não filtra): nesse caso ele simplesmente não vale.
function montarRestricao(
  executor: ExecutorBanco,
  link: LinkGravado,
): FiltroAtividades | null {
  const escopo = listarIdsDoEscopo(executor, link.id);
  if (escopo.tagIds.length === 0 && escopo.solicitanteIds.length === 0) {
    return null;
  }
  return {
    ...escopo,
    prioridadeMinima: link.prioridadeMinima,
    prioridadeMaxima: link.prioridadeMaxima,
    arquivamento: link.incluirArquivadas ? 'todas' : 'ativas',
  };
}

// O link padrão é restrito sem escopo de propósito: vê o board inteiro, só as
// ativas, e continua somente leitura (modalidade restrita, garantida também
// por CHECK no banco). Nos demais restritos, escopo vazio invalida o link.
function montarRestricaoDoLink(
  executor: ExecutorBanco,
  link: LinkGravado,
): FiltroAtividades | null {
  if (link.modalidade === 'completo') {
    return null;
  }
  return link.padrao
    ? criarFiltroAtividades({ arquivamento: 'ativas' })
    : montarRestricao(executor, link);
}

function registrarAcessoSeNecessario(
  executor: ExecutorBanco,
  linkId: number,
  agora: Date,
): void {
  const limiteSemRegistro = somarMinutos(
    agora,
    -COMPARTILHAMENTO.INTERVALO_REGISTRO_ACESSO_MINUTOS,
  ).toISOString();
  executor
    .update(linksCompartilhamento)
    .set({ ultimoAcessoEm: agora.toISOString() })
    .where(
      and(
        eq(linksCompartilhamento.id, linkId),
        or(
          isNull(linksCompartilhamento.ultimoAcessoEm),
          lte(linksCompartilhamento.ultimoAcessoEm, limiteSemRegistro),
        ),
      ),
    )
    .run();
}

// Chamada a cada requisição (página, ação ou download): como nada fica em
// cache, revogar ou expirar o link corta o acesso na requisição seguinte.
export function validarTokenCompartilhamento(
  executor: ExecutorBanco,
  token: unknown,
  agora: Date = new Date(),
): LinkValidado | null {
  if (!ehFormatoTokenCompartilhamento(token)) {
    return null;
  }
  const board = buscarBoardPadrao(executor);
  if (!board) {
    return null;
  }
  const link = executor
    .select({
      id: linksCompartilhamento.id,
      nome: linksCompartilhamento.nome,
      modalidade: linksCompartilhamento.modalidade,
      incluirArquivadas: linksCompartilhamento.incluirArquivadas,
      prioridadeMinima: linksCompartilhamento.prioridadeMinima,
      prioridadeMaxima: linksCompartilhamento.prioridadeMaxima,
      expiraEm: linksCompartilhamento.expiraEm,
      padrao: linksCompartilhamento.padrao,
      animal: linksCompartilhamento.animal,
    })
    .from(linksCompartilhamento)
    .where(
      and(
        eq(linksCompartilhamento.hashToken, calcularHashToken(token)),
        eq(linksCompartilhamento.boardId, board.id),
        isNull(linksCompartilhamento.revogadoEm),
        or(
          isNull(linksCompartilhamento.expiraEm),
          gt(linksCompartilhamento.expiraEm, agora.toISOString()),
        ),
      ),
    )
    .get();
  if (!link) {
    return null;
  }
  const restricao = montarRestricaoDoLink(executor, link);
  if (link.modalidade === 'restrito' && restricao === null) {
    return null;
  }
  registrarAcessoSeNecessario(executor, link.id, agora);
  return {
    linkId: link.id,
    nome: link.nome,
    modalidade: link.modalidade,
    incluirArquivadas: link.modalidade === 'completo' || link.incluirArquivadas,
    expiraEm: link.expiraEm,
    restricao,
    padrao: link.padrao,
    animal: ehChaveAnimal(link.animal) ? link.animal : null,
  };
}
