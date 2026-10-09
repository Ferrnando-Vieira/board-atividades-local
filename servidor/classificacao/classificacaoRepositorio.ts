import { and, eq, inArray, ne } from 'drizzle-orm';
import { LIMITES_TEXTO } from '@/config/constantes';
import type { ExecutorBanco } from '@/servidor/banco/conexao';
import { solicitantes, tags } from '@/servidor/banco/esquema';
import { mensagensSolicitantes } from '@/servidor/classificacao/mensagensSolicitantes';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';
import {
  gerarChaveNormalizada,
  normalizarNomeExibicao,
} from '@/util/NormalizacaoUtils';

export type RegistroGarantido = {
  id: number;
  nome: string;
  criado: boolean;
};

export type SolicitanteResumo = {
  id: number;
  nome: string;
};

export const CODIGO_SOLICITANTE_OBRIGATORIO = 'solicitante-obrigatorio';

type TabelaClassificacao = typeof solicitantes | typeof tags;

function prepararNome(nome: string, tamanhoMaximo: number, rotulo: string) {
  const nomeExibicao = normalizarNomeExibicao(nome);
  if (nomeExibicao.length === 0) {
    throw new ErroApp(`O nome do ${rotulo} não pode ficar vazio.`, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: 'nome-vazio',
    });
  }
  if (nomeExibicao.length > tamanhoMaximo) {
    throw new ErroApp(
      `O nome do ${rotulo} pode ter no máximo ${tamanhoMaximo} caracteres.`,
      { status: STATUS_ERRO.REQUISICAO_INVALIDA, codigo: 'nome-longo' },
    );
  }
  return { nomeExibicao, nomeNormalizado: gerarChaveNormalizada(nomeExibicao) };
}

// INSERT ... ON CONFLICT DO NOTHING seguido de SELECT: a unicidade fica a cargo
// do índice único, então duas gravações concorrentes não duplicam o registro.
function garantirRegistro(
  executor: ExecutorBanco,
  tabela: TabelaClassificacao,
  boardId: number,
  nome: string,
  tamanhoMaximo: number,
  rotulo: string,
): RegistroGarantido {
  const { nomeExibicao, nomeNormalizado } = prepararNome(
    nome,
    tamanhoMaximo,
    rotulo,
  );
  const inserido = executor
    .insert(tabela)
    .values({ boardId, nome: nomeExibicao, nomeNormalizado })
    .onConflictDoNothing({ target: [tabela.boardId, tabela.nomeNormalizado] })
    .returning({ id: tabela.id, nome: tabela.nome })
    .get();
  if (inserido) {
    return { ...inserido, criado: true };
  }
  const existente = executor
    .select({ id: tabela.id, nome: tabela.nome })
    .from(tabela)
    .where(
      and(
        eq(tabela.boardId, boardId),
        eq(tabela.nomeNormalizado, nomeNormalizado),
      ),
    )
    .get();
  if (!existente) {
    throw new ErroApp(`Não foi possível registrar o ${rotulo} "${nome}".`);
  }
  return { ...existente, criado: false };
}

export function garantirSolicitante(
  executor: ExecutorBanco,
  boardId: number,
  nome: string,
): RegistroGarantido {
  return garantirRegistro(
    executor,
    solicitantes,
    boardId,
    nome,
    LIMITES_TEXTO.NOME_SOLICITANTE,
    'solicitante',
  );
}

export function buscarSolicitantePadrao(
  executor: ExecutorBanco,
  boardId: number,
): SolicitanteResumo | undefined {
  return executor
    .select({ id: solicitantes.id, nome: solicitantes.nome })
    .from(solicitantes)
    .where(
      and(eq(solicitantes.boardId, boardId), eq(solicitantes.padrao, true)),
    )
    .get();
}

// Solicitante padrão da primeira tag, na ordem dada, que defina um. Tags
// ainda sem cadastro não definem nada.
export function buscarSolicitantePadraoDasTags(
  executor: ExecutorBanco,
  boardId: number,
  nomesTags: readonly string[],
): SolicitanteResumo | undefined {
  if (nomesTags.length === 0) {
    return undefined;
  }
  const chaves = nomesTags.map(gerarChaveNormalizada);
  const porChave = new Map(
    executor
      .select({
        chave: tags.nomeNormalizado,
        id: solicitantes.id,
        nome: solicitantes.nome,
      })
      .from(tags)
      .innerJoin(solicitantes, eq(solicitantes.id, tags.solicitantePadraoId))
      .where(
        and(eq(tags.boardId, boardId), inArray(tags.nomeNormalizado, chaves)),
      )
      .all()
      .map(({ chave, ...solicitante }) => [chave, solicitante]),
  );
  for (const chave of chaves) {
    const solicitante = porChave.get(chave);
    if (solicitante) {
      return solicitante;
    }
  }
  return undefined;
}

// Nome nulo (campo em branco) usa o solicitante padrão da primeira tag que
// tenha um (`tagsEmOrdem` vem na ordem em que as tags foram vinculadas) e,
// sem isso, o padrão do board; sem nenhum dos dois, o nome é obrigatório.
export function garantirSolicitanteOuPadrao(
  executor: ExecutorBanco,
  boardId: number,
  nome: string | null,
  tagsEmOrdem: readonly string[] = [],
): SolicitanteResumo {
  if (nome !== null) {
    return garantirSolicitante(executor, boardId, nome);
  }
  const padrao =
    buscarSolicitantePadraoDasTags(executor, boardId, tagsEmOrdem) ??
    buscarSolicitantePadrao(executor, boardId);
  if (!padrao) {
    throw new ErroApp(mensagensSolicitantes.padraoAusente, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGO_SOLICITANTE_OBRIGATORIO,
    });
  }
  return padrao;
}

// Cadastra o nome se ainda não existe e passa a marca de padrão para ele. O
// anterior é desmarcado antes por causa do índice único parcial.
export function definirSolicitantePadrao(
  executor: ExecutorBanco,
  boardId: number,
  nome: string,
): RegistroGarantido {
  const solicitante = garantirSolicitante(executor, boardId, nome);
  executor
    .update(solicitantes)
    .set({ padrao: false })
    .where(
      and(
        eq(solicitantes.boardId, boardId),
        eq(solicitantes.padrao, true),
        ne(solicitantes.id, solicitante.id),
      ),
    )
    .run();
  executor
    .update(solicitantes)
    .set({ padrao: true })
    .where(
      and(eq(solicitantes.id, solicitante.id), eq(solicitantes.padrao, false)),
    )
    .run();
  return solicitante;
}

export function garantirTag(
  executor: ExecutorBanco,
  boardId: number,
  nome: string,
): RegistroGarantido {
  return garantirRegistro(
    executor,
    tags,
    boardId,
    nome,
    LIMITES_TEXTO.NOME_TAG,
    'tag',
  );
}

// Mesma chave do cadastro: "faturas" e "Faturas" encontram a mesma tag.
// Nomes sem cadastro são ignorados.
function listarIdsPorNomes(
  executor: ExecutorBanco,
  tabela: TabelaClassificacao,
  boardId: number,
  nomes: readonly string[],
): number[] {
  if (nomes.length === 0) {
    return [];
  }
  return executor
    .select({ id: tabela.id })
    .from(tabela)
    .where(
      and(
        eq(tabela.boardId, boardId),
        inArray(tabela.nomeNormalizado, nomes.map(gerarChaveNormalizada)),
      ),
    )
    .all()
    .map((linha) => linha.id);
}

export function listarIdsTagsPorNomes(
  executor: ExecutorBanco,
  boardId: number,
  nomes: readonly string[],
): number[] {
  return listarIdsPorNomes(executor, tags, boardId, nomes);
}

export function listarIdsSolicitantesPorNomes(
  executor: ExecutorBanco,
  boardId: number,
  nomes: readonly string[],
): number[] {
  return listarIdsPorNomes(executor, solicitantes, boardId, nomes);
}
