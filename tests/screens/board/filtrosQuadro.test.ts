import {
  alternarFiltro,
  cartaoAtendeFiltros,
  extrairOpcoesFiltro,
  FILTROS_VAZIOS,
  filtrarColunas,
  interpretarFiltrosSalvos,
  manterOpcoesDisponiveis,
  possuiFiltrosAtivos,
  PRIORIDADES_FILTRAVEIS,
  serializarFiltros,
  type FiltrosQuadro,
} from '@/screens/board/filtrosQuadro';
import type {
  CartaoQuadro,
  ColunaQuadro,
} from '@/servidor/board/consultaQuadro';
import type { TagResumo } from '@/servidor/classificacao/consultasClassificacao';

const TAG_FATURAS = { id: 1, nome: 'Faturas', cor: null };
const TAG_BUGS = { id: 2, nome: 'Bugs', cor: '#fecaca' };
const TAG_INFRA = { id: 3, nome: 'Infra', cor: null };
const SOLICITANTE_EU = { id: 10, nome: 'Eu' };
const SOLICITANTE_FINANCEIRO = { id: 11, nome: 'Financeiro' };
const CRIACAO = '2026-09-01T00:00:00.000Z';

function montarCartao(
  id: number,
  prioridade: number,
  solicitante: { id: number; nome: string },
  tags: TagResumo[],
): CartaoQuadro {
  return {
    id,
    titulo: `Atividade ${id}`,
    prioridade,
    versao: 1,
    criadoEm: CRIACAO,
    solicitanteId: solicitante.id,
    solicitante: solicitante.nome,
    tags,
    prazoData: null,
    prazoHora: null,
    concluidaEmData: null,
    concluidaEmHora: null,
  };
}

const CARTAO_FATURAS_EU = montarCartao(1, 0, SOLICITANTE_EU, [TAG_FATURAS]);
const CARTAO_BUGS_FINANCEIRO = montarCartao(2, 3, SOLICITANTE_FINANCEIRO, [
  TAG_BUGS,
]);
const CARTAO_AMBAS_FINANCEIRO = montarCartao(3, 5, SOLICITANTE_FINANCEIRO, [
  TAG_FATURAS,
  TAG_BUGS,
]);
const CARTAO_SEM_TAGS_EU = montarCartao(4, 9, SOLICITANTE_EU, []);

function montarColunas(): ColunaQuadro[] {
  return [
    {
      id: 100,
      nome: 'A Fazer',
      finalizaAtividade: false,
      corTitulo: null,
      corColuna: null,
      atividades: [CARTAO_FATURAS_EU, CARTAO_BUGS_FINANCEIRO],
    },
    {
      id: 200,
      nome: 'Concluídos',
      finalizaAtividade: true,
      corTitulo: null,
      corColuna: null,
      atividades: [CARTAO_AMBAS_FINANCEIRO, CARTAO_SEM_TAGS_EU],
    },
  ];
}

function filtros(parcial: Partial<FiltrosQuadro>): FiltrosQuadro {
  return { ...FILTROS_VAZIOS, ...parcial };
}

function idsVisiveis(filtrosAtivos: FiltrosQuadro): number[] {
  return filtrarColunas(montarColunas(), filtrosAtivos).flatMap((coluna) =>
    coluna.atividades.map((cartao) => cartao.id),
  );
}

describe('filtrosQuadro', () => {
  describe('cartaoAtendeFiltros', () => {
    it('deve aceitar qualquer cartão sem filtros', () => {
      expect(cartaoAtendeFiltros(CARTAO_SEM_TAGS_EU, FILTROS_VAZIOS)).toBe(
        true,
      );
    });

    it('deve combinar tags com OU dentro da categoria', () => {
      expect(
        idsVisiveis(filtros({ tagIds: [TAG_FATURAS.id, TAG_BUGS.id] })),
      ).toEqual([1, 2, 3]);
    });

    it('deve combinar solicitantes com OU dentro da categoria', () => {
      expect(
        idsVisiveis(
          filtros({
            solicitanteIds: [SOLICITANTE_EU.id, SOLICITANTE_FINANCEIRO.id],
          }),
        ),
      ).toEqual([1, 2, 3, 4]);
    });

    it('deve combinar prioridades com OU dentro da categoria', () => {
      expect(idsVisiveis(filtros({ prioridades: [0, 9] }))).toEqual([1, 4]);
    });

    it('deve combinar categorias diferentes com E', () => {
      expect(
        idsVisiveis(
          filtros({
            tagIds: [TAG_FATURAS.id],
            solicitanteIds: [SOLICITANTE_FINANCEIRO.id],
          }),
        ),
      ).toEqual([3]);
      expect(
        idsVisiveis(
          filtros({
            tagIds: [TAG_FATURAS.id],
            solicitanteIds: [SOLICITANTE_FINANCEIRO.id],
            prioridades: [0],
          }),
        ),
      ).toEqual([]);
    });

    it('deve excluir cartões sem tag quando há filtro de tag', () => {
      expect(idsVisiveis(filtros({ tagIds: [TAG_INFRA.id] }))).toEqual([]);
    });
  });

  describe('filtrarColunas', () => {
    it('deve manter todas as colunas e a ordem dos cartões', () => {
      const resultado = filtrarColunas(
        montarColunas(),
        filtros({ solicitanteIds: [SOLICITANTE_FINANCEIRO.id] }),
      );

      expect(resultado.map((coluna) => coluna.id)).toEqual([100, 200]);
      expect(resultado[1]?.atividades.map((cartao) => cartao.id)).toEqual([3]);
    });

    it('deve devolver a mesma lista quando não há filtro', () => {
      const colunas = montarColunas();

      expect(filtrarColunas(colunas, FILTROS_VAZIOS)).toBe(colunas);
    });
  });

  describe('alternarFiltro', () => {
    it('deve acumular e depois remover um valor da categoria', () => {
      const comFaturas = alternarFiltro(
        FILTROS_VAZIOS,
        'tagIds',
        TAG_FATURAS.id,
      );
      const comDuas = alternarFiltro(comFaturas, 'tagIds', TAG_BUGS.id);
      const semFaturas = alternarFiltro(comDuas, 'tagIds', TAG_FATURAS.id);

      expect(comDuas.tagIds).toEqual([TAG_FATURAS.id, TAG_BUGS.id]);
      expect(semFaturas.tagIds).toEqual([TAG_BUGS.id]);
      expect(
        possuiFiltrosAtivos(alternarFiltro(semFaturas, 'tagIds', TAG_BUGS.id)),
      ).toBe(false);
    });

    it('não deve alterar as demais categorias', () => {
      const inicial = filtros({ prioridades: [2] });

      expect(
        alternarFiltro(inicial, 'solicitanteIds', SOLICITANTE_EU.id),
      ).toEqual({
        tagIds: [],
        solicitanteIds: [SOLICITANTE_EU.id],
        prioridades: [2],
      });
    });
  });

  describe('extrairOpcoesFiltro', () => {
    it('deve listar tags e solicitantes dos cartões, sem repetição e em ordem alfabética', () => {
      const opcoes = extrairOpcoesFiltro(montarColunas());

      expect(opcoes.tags).toEqual([TAG_BUGS, TAG_FATURAS]);
      expect(opcoes.solicitantes).toEqual([
        SOLICITANTE_EU,
        SOLICITANTE_FINANCEIRO,
      ]);
      expect(opcoes.prioridades).toEqual(PRIORIDADES_FILTRAVEIS);
    });
  });

  describe('manterOpcoesDisponiveis', () => {
    it('deve descartar filtros de itens que sumiram do quadro', () => {
      const opcoes = extrairOpcoesFiltro(montarColunas());

      expect(
        manterOpcoesDisponiveis(
          filtros({
            tagIds: [TAG_INFRA.id, TAG_BUGS.id],
            solicitanteIds: [999],
            prioridades: [3, 42],
          }),
          opcoes,
        ),
      ).toEqual({
        tagIds: [TAG_BUGS.id],
        solicitanteIds: [],
        prioridades: [3],
      });
    });
  });

  describe('persistência na sessão', () => {
    it('deve recuperar exatamente o que foi serializado', () => {
      const original = filtros({ tagIds: [1, 2], prioridades: [0] });

      expect(interpretarFiltrosSalvos(serializarFiltros(original))).toEqual(
        original,
      );
    });

    it.each([
      null,
      '',
      'não é json',
      '{"tagIds":"x"}',
      '[1,2]',
      '{"tagIds":[-1]}',
    ])('deve tratar %p como sem filtro, sem quebrar', (texto) => {
      const resultado = interpretarFiltrosSalvos(texto);

      expect(possuiFiltrosAtivos(resultado)).toBe(false);
    });
  });
});
