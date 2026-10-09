import { z } from 'zod';
import { PRIORIDADE } from '@/config/constantes';
import type {
  CartaoQuadro,
  ColunaQuadro,
} from '@/servidor/board/consultaQuadro';
import { compararTextos } from '@/util/NormalizacaoUtils';

export type FiltrosQuadro = {
  tagIds: readonly number[];
  solicitanteIds: readonly number[];
  prioridades: readonly number[];
};

export type CategoriaFiltro = keyof FiltrosQuadro;

export type OpcaoFiltro = {
  id: number;
  nome: string;
  // Só tags têm cor (nula = chip neutro).
  cor?: string | null;
};

export type OpcoesFiltroQuadro = {
  tags: OpcaoFiltro[];
  solicitantes: OpcaoFiltro[];
  prioridades: number[];
};

export const FILTROS_VAZIOS: FiltrosQuadro = {
  tagIds: [],
  solicitanteIds: [],
  prioridades: [],
};

export const PRIORIDADES_FILTRAVEIS = Array.from(
  { length: PRIORIDADE.MAIS_BAIXA - PRIORIDADE.MAIS_ALTA + 1 },
  (_, indice) => PRIORIDADE.MAIS_ALTA + indice,
);

const esquemaListaIds = z.array(z.int().nonnegative()).catch([]);

// O conteúdo vem do sessionStorage do navegador: qualquer valor estranho vira
// "sem filtro" em vez de quebrar o quadro.
const esquemaFiltrosSalvos = z
  .object({
    tagIds: esquemaListaIds,
    solicitanteIds: esquemaListaIds,
    prioridades: esquemaListaIds,
  })
  .catch(() => ({ tagIds: [], solicitanteIds: [], prioridades: [] }));

export function interpretarFiltrosSalvos(texto: string | null): FiltrosQuadro {
  if (!texto) {
    return FILTROS_VAZIOS;
  }
  try {
    return esquemaFiltrosSalvos.parse(JSON.parse(texto));
  } catch {
    return FILTROS_VAZIOS;
  }
}

export function serializarFiltros(filtros: FiltrosQuadro): string {
  return JSON.stringify(filtros);
}

export function possuiFiltrosAtivos(filtros: FiltrosQuadro): boolean {
  return (
    filtros.tagIds.length > 0 ||
    filtros.solicitanteIds.length > 0 ||
    filtros.prioridades.length > 0
  );
}

export function alternarFiltro(
  filtros: FiltrosQuadro,
  categoria: CategoriaFiltro,
  valor: number,
): FiltrosQuadro {
  const atuais = filtros[categoria];
  return {
    ...filtros,
    [categoria]: atuais.includes(valor)
      ? atuais.filter((item) => item !== valor)
      : [...atuais, valor],
  };
}

// Mesma semântica dos links restritos: OU dentro de cada categoria, E entre
// categorias, e categoria vazia não restringe.
export function cartaoAtendeFiltros(
  cartao: CartaoQuadro,
  filtros: FiltrosQuadro,
): boolean {
  const atendeTags =
    filtros.tagIds.length === 0 ||
    cartao.tags.some((tag) => filtros.tagIds.includes(tag.id));
  const atendeSolicitantes =
    filtros.solicitanteIds.length === 0 ||
    filtros.solicitanteIds.includes(cartao.solicitanteId);
  const atendePrioridades =
    filtros.prioridades.length === 0 ||
    filtros.prioridades.includes(cartao.prioridade);
  return atendeTags && atendeSolicitantes && atendePrioridades;
}

// As colunas continuam todas (com suas contagens filtradas); só os cartões
// são filtrados, e a ordem automática de cada coluna é preservada.
export function filtrarColunas(
  colunas: ColunaQuadro[],
  filtros: FiltrosQuadro,
): ColunaQuadro[] {
  if (!possuiFiltrosAtivos(filtros)) {
    return colunas;
  }
  return colunas.map((coluna) => ({
    ...coluna,
    atividades: coluna.atividades.filter((cartao) =>
      cartaoAtendeFiltros(cartao, filtros),
    ),
  }));
}

function ordenarOpcoes(opcoes: Map<number, OpcaoFiltro>): OpcaoFiltro[] {
  return [...opcoes.values()].sort((primeira, segunda) =>
    compararTextos(primeira.nome, segunda.nome),
  );
}

// As opções saem dos próprios cartões já carregados: nenhuma requisição a
// mais, e um link restrito só vê tags e solicitantes do seu escopo.
export function extrairOpcoesFiltro(
  colunas: readonly ColunaQuadro[],
): OpcoesFiltroQuadro {
  const tags = new Map<number, OpcaoFiltro>();
  const solicitantes = new Map<number, OpcaoFiltro>();
  for (const coluna of colunas) {
    for (const cartao of coluna.atividades) {
      solicitantes.set(cartao.solicitanteId, {
        id: cartao.solicitanteId,
        nome: cartao.solicitante,
      });
      for (const tag of cartao.tags) {
        tags.set(tag.id, { id: tag.id, nome: tag.nome, cor: tag.cor });
      }
    }
  }
  return {
    tags: ordenarOpcoes(tags),
    solicitantes: ordenarOpcoes(solicitantes),
    prioridades: PRIORIDADES_FILTRAVEIS,
  };
}

// Um filtro salvo cujo item sumiu do quadro (tag excluída, por exemplo) não
// pode esconder tudo sem aparecer na tela: só valem os itens ainda exibíveis.
export function manterOpcoesDisponiveis(
  filtros: FiltrosQuadro,
  opcoes: OpcoesFiltroQuadro,
): FiltrosQuadro {
  const idsTags = new Set(opcoes.tags.map((opcao) => opcao.id));
  const idsSolicitantes = new Set(opcoes.solicitantes.map((opcao) => opcao.id));
  return {
    tagIds: filtros.tagIds.filter((id) => idsTags.has(id)),
    solicitanteIds: filtros.solicitanteIds.filter((id) =>
      idsSolicitantes.has(id),
    ),
    prioridades: filtros.prioridades.filter((prioridade) =>
      opcoes.prioridades.includes(prioridade),
    ),
  };
}
