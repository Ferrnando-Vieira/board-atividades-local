import {
  listasIguais,
  moverParaPosicao,
  possuiRepetidos,
  removerItem,
} from '@/util/ListaUtils';

const LISTA_BASE = [10, 20, 30, 40];

describe('ListaUtils', () => {
  describe('listasIguais', () => {
    it('deve considerar iguais listas com os mesmos itens na mesma ordem', () => {
      expect(listasIguais(LISTA_BASE, [10, 20, 30, 40])).toBe(true);
    });

    it('deve diferenciar listas com os mesmos itens em outra ordem', () => {
      expect(listasIguais(LISTA_BASE, [20, 10, 30, 40])).toBe(false);
    });

    it('deve diferenciar listas de tamanhos diferentes', () => {
      expect(listasIguais(LISTA_BASE, [10, 20, 30])).toBe(false);
    });

    it('deve considerar iguais duas listas vazias', () => {
      expect(listasIguais([], [])).toBe(true);
    });
  });

  describe('possuiRepetidos', () => {
    it('deve detectar item repetido', () => {
      expect(possuiRepetidos([1, 2, 1])).toBe(true);
    });

    it('deve aceitar lista sem repetição', () => {
      expect(possuiRepetidos(LISTA_BASE)).toBe(false);
    });
  });

  describe('moverParaPosicao', () => {
    it('deve mover o item para a posição contada na lista sem ele', () => {
      expect(moverParaPosicao(LISTA_BASE, 10, 2)).toEqual([20, 30, 10, 40]);
    });

    it('deve inserir item que não estava na lista', () => {
      expect(moverParaPosicao(LISTA_BASE, 99, 1)).toEqual([10, 99, 20, 30, 40]);
    });

    it('deve limitar posições fora do intervalo ao início ou ao fim', () => {
      expect(moverParaPosicao(LISTA_BASE, 20, -5)).toEqual([20, 10, 30, 40]);
      expect(moverParaPosicao(LISTA_BASE, 20, 50)).toEqual([10, 30, 40, 20]);
    });

    it('não deve alterar a lista original', () => {
      const original = [...LISTA_BASE];

      moverParaPosicao(original, 40, 0);

      expect(original).toEqual(LISTA_BASE);
    });
  });

  describe('removerItem', () => {
    it('deve remover todas as ocorrências do item', () => {
      expect(removerItem([1, 2, 1, 3], 1)).toEqual([2, 3]);
    });

    it('deve devolver cópia igual quando o item não existe', () => {
      expect(removerItem(LISTA_BASE, 7)).toEqual(LISTA_BASE);
    });
  });
});
