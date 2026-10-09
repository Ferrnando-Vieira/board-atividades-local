import {
  extrairPalavrasBusca,
  textosCorrespondemBusca,
} from '@/util/BuscaUtils';

describe('BuscaUtils', () => {
  describe('extrairPalavrasBusca', () => {
    it('deve normalizar acento, caixa e espaços e remover palavras repetidas', () => {
      const palavras = extrairPalavrasBusca('  Relatório   RELATORIO  Fiscal ');

      expect(palavras).toEqual(['relatorio', 'fiscal']);
    });

    it('deve devolver lista vazia para termo em branco', () => {
      expect(extrairPalavrasBusca('   ')).toEqual([]);
    });
  });

  describe('textosCorrespondemBusca', () => {
    const TEXTOS = ['Conferir faturas', null, 'Financeiro', 'Cobrança'];

    it('deve exigir todas as palavras, em qualquer ordem e em qualquer texto', () => {
      const corresponde = textosCorrespondemBusca(
        TEXTOS,
        extrairPalavrasBusca('financeiro FATURAS'),
      );

      expect(corresponde).toBe(true);
    });

    it('deve ignorar acentos ao comparar', () => {
      expect(
        textosCorrespondemBusca(TEXTOS, extrairPalavrasBusca('cobranca')),
      ).toBe(true);
    });

    it('não deve corresponder quando falta uma das palavras', () => {
      expect(
        textosCorrespondemBusca(TEXTOS, extrairPalavrasBusca('faturas bugs')),
      ).toBe(false);
    });

    it('deve aceitar tudo quando não há palavras', () => {
      expect(textosCorrespondemBusca(TEXTOS, [])).toBe(true);
    });
  });
});
