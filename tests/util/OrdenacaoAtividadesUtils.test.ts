import {
  CAMPOS_ORDEM_AUTOMATICA,
  compararPorOrdemAutomatica,
  compararPorPrazoETitulo,
  ordenarNaColuna,
  ordenarPorOrdemAutomatica,
  type ItemConcluivel,
  type ItemOrdenavel,
} from '@/util/OrdenacaoAtividadesUtils';

const CRIACAO_ANTIGA = '2026-09-20T10:00:00.000Z';
const CRIACAO_RECENTE = '2026-09-25T10:00:00.000Z';
const PRIORIDADE_CRITICA = 0;
const PRIORIDADE_PADRAO = 5;
const PRIORIDADE_BAIXA = 9;

function item(
  id: number,
  prioridade: number,
  criadoEm: string = CRIACAO_ANTIGA,
): ItemOrdenavel {
  return { id, prioridade, criadoEm };
}

describe('OrdenacaoAtividadesUtils', () => {
  it('deve usar prioridade, data de criação e identificador, nesta ordem', () => {
    expect(CAMPOS_ORDEM_AUTOMATICA).toEqual(['prioridade', 'criadoEm', 'id']);
  });

  describe('compararPorOrdemAutomatica', () => {
    it('deve colocar a prioridade 0 antes da 9, mesmo sendo mais recente', () => {
      const critica = item(2, PRIORIDADE_CRITICA, CRIACAO_RECENTE);
      const baixa = item(1, PRIORIDADE_BAIXA, CRIACAO_ANTIGA);

      expect(compararPorOrdemAutomatica(critica, baixa)).toBeLessThan(0);
    });

    it('deve colocar a mais antiga primeiro quando a prioridade empata', () => {
      const antiga = item(9, PRIORIDADE_PADRAO, CRIACAO_ANTIGA);
      const recente = item(1, PRIORIDADE_PADRAO, CRIACAO_RECENTE);

      expect(compararPorOrdemAutomatica(antiga, recente)).toBeLessThan(0);
    });

    it('deve desempatar pelo identificador quando prioridade e criação coincidem', () => {
      expect(
        compararPorOrdemAutomatica(
          item(3, PRIORIDADE_PADRAO),
          item(7, PRIORIDADE_PADRAO),
        ),
      ).toBeLessThan(0);
      expect(
        compararPorOrdemAutomatica(
          item(7, PRIORIDADE_PADRAO),
          item(7, PRIORIDADE_PADRAO),
        ),
      ).toBe(0);
    });
  });

  describe('ordenarPorOrdemAutomatica', () => {
    it('deve devolver uma lista nova e determinística sem alterar a original', () => {
      const original = [
        item(4, PRIORIDADE_PADRAO, CRIACAO_RECENTE),
        item(3, PRIORIDADE_BAIXA),
        item(2, PRIORIDADE_PADRAO, CRIACAO_ANTIGA),
        item(1, PRIORIDADE_CRITICA, CRIACAO_RECENTE),
      ];

      const ordenada = ordenarPorOrdemAutomatica(original);

      expect(ordenada.map((atual) => atual.id)).toEqual([1, 2, 4, 3]);
      expect(original.map((atual) => atual.id)).toEqual([4, 3, 2, 1]);
    });

    it('deve devolver lista vazia para entrada vazia', () => {
      expect(ordenarPorOrdemAutomatica([])).toEqual([]);
    });
  });

  describe('ordenarNaColuna', () => {
    function concluido(
      id: number,
      concluidaEmData: string | null,
      concluidaEmHora: string | null = null,
    ): ItemConcluivel {
      return {
        ...item(id, PRIORIDADE_PADRAO),
        titulo: `Cartão ${id}`,
        prazoData: null,
        prazoHora: null,
        concluidaEmData,
        concluidaEmHora,
      };
    }

    it('deve ordenar pela conclusão mais recente nas colunas que finalizam', () => {
      const lista = [
        concluido(1, '2026-10-01', '09:00'),
        concluido(2, '2026-10-05', '08:00'),
        concluido(3, '2026-10-05', '17:30'),
        concluido(4, '2026-09-20'),
      ];

      expect(ordenarNaColuna(lista, true).map((atual) => atual.id)).toEqual([
        3, 2, 1, 4,
      ]);
    });

    it('deve deixar sem conclusão no fim e desempatar pela ordem automática', () => {
      const lista = [
        concluido(5, null),
        concluido(2, '2026-10-05', '10:00'),
        concluido(1, '2026-10-05', '10:00'),
      ];

      expect(ordenarNaColuna(lista, true).map((atual) => atual.id)).toEqual([
        1, 2, 5,
      ]);
    });

    it('deve manter a ordem automática nas colunas que não finalizam', () => {
      const lista = [
        {
          ...item(2, PRIORIDADE_PADRAO),
          titulo: 'B',
          prazoData: null,
          prazoHora: null,
          concluidaEmData: '2026-10-05',
          concluidaEmHora: null,
        },
        {
          ...item(1, PRIORIDADE_CRITICA),
          titulo: 'A',
          prazoData: null,
          prazoHora: null,
          concluidaEmData: null,
          concluidaEmHora: null,
        },
      ];

      expect(ordenarNaColuna(lista, false).map((atual) => atual.id)).toEqual([
        1, 2,
      ]);
    });
  });

  describe('compararPorPrazoETitulo', () => {
    function cartao(
      id: number,
      titulo: string,
      prazoData: string | null = null,
      prazoHora: string | null = null,
      prioridade: number = PRIORIDADE_PADRAO,
    ): ItemConcluivel {
      return {
        ...item(id, prioridade),
        titulo,
        prazoData,
        prazoHora,
        concluidaEmData: null,
        concluidaEmHora: null,
      };
    }

    function ids(lista: ItemConcluivel[]): number[] {
      return ordenarNaColuna(lista, false).map((atual) => atual.id);
    }

    it('deve manter a prioridade acima do prazo', () => {
      expect(
        ids([
          cartao(1, 'A', '2026-10-01'),
          cartao(2, 'Z', null, null, PRIORIDADE_CRITICA),
        ]),
      ).toEqual([2, 1]);
    });

    it('deve colocar o prazo mais próximo primeiro e os sem prazo no fim', () => {
      expect(
        ids([
          cartao(1, 'A'),
          cartao(2, 'B', '2026-10-09'),
          cartao(3, 'C', '2026-10-08', '17:00'),
          cartao(4, 'D', '2026-10-08', '09:00'),
          cartao(5, 'E', '2026-10-08'),
        ]),
      ).toEqual([4, 3, 5, 2, 1]);
    });

    it('deve ordenar por título, ignorando acento e caixa, quando o prazo empata', () => {
      expect(
        ids([
          cartao(1, 'Modal'),
          cartao(2, 'álgebra'),
          cartao(3, 'Cadastro'),
          cartao(4, 'adicionar'),
        ]),
      ).toEqual([4, 2, 3, 1]);
    });

    it('deve cair na ordem base quando o título também empata', () => {
      expect(
        compararPorPrazoETitulo(cartao(1, 'Igual'), cartao(2, 'Igual')),
      ).toBeLessThan(0);
    });
  });
});
