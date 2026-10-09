import {
  ehChaveAnexoNovo,
  lerReferenciaAnexo,
  listarChavesAnexosNovos,
  listarIdsAnexosReferenciados,
  montarMarcacaoImagem,
  montarReferenciaAnexo,
  montarReferenciaAnexoNovo,
  substituirReferenciasAnexosNovos,
} from '@/util/DescricaoUtils';

const CHAVE = 'a1b2c3d4e5f60718';
const OUTRA_CHAVE = '0f1e2d3c4b5a6978';

describe('DescricaoUtils', () => {
  describe('lerReferenciaAnexo', () => {
    it('deve ler a referência de um anexo gravado', () => {
      expect(lerReferenciaAnexo('anexo:12')).toEqual({
        tipo: 'anexo',
        anexoId: 12,
      });
    });

    it('deve ler a referência de uma imagem ainda não salva', () => {
      expect(lerReferenciaAnexo(`anexo-novo:${CHAVE}`)).toEqual({
        tipo: 'novo',
        chave: CHAVE,
      });
    });

    it.each([
      'anexo:0',
      'anexo:-1',
      'anexo:1e3',
      'anexo:12abc',
      'anexo:',
      'anexo-novo:CURTA',
      'anexo-novo:com espaço',
      'https://exemplo.com/a.png',
      'javascript:alert(1)',
    ])('deve recusar %s', (url) => {
      expect(lerReferenciaAnexo(url)).toBeNull();
    });
  });

  describe('montarMarcacaoImagem', () => {
    it('deve montar a imagem em Markdown com a referência', () => {
      expect(
        montarMarcacaoImagem('tela de erro', montarReferenciaAnexo(7)),
      ).toBe('![tela de erro](anexo:7)');
    });

    it('não deve deixar colchetes, barras ou quebras fecharem a marcação', () => {
      expect(
        montarMarcacaoImagem(
          'nome ]com [colchetes]\\\n e quebra',
          montarReferenciaAnexoNovo(CHAVE),
        ),
      ).toBe(`![nome com colchetes e quebra](anexo-novo:${CHAVE})`);
    });
  });

  describe('referências na descrição', () => {
    const descricao = [
      'Erro ao salvar:',
      `![print](anexo-novo:${CHAVE})`,
      `![outro](anexo-novo:${OUTRA_CHAVE} "título")`,
      `![repetido](anexo-novo:${CHAVE})`,
      '![gravada](anexo:41) e ![outra](anexo:7)',
      'texto solto anexo-novo:ffffffffffffffff fora de imagem',
    ].join('\n');

    it('deve listar as chaves das imagens não salvas sem repetir', () => {
      expect(listarChavesAnexosNovos(descricao)).toEqual([CHAVE, OUTRA_CHAVE]);
    });

    it('deve listar os anexos referenciados sem repetir', () => {
      expect(listarIdsAnexosReferenciados(descricao)).toEqual([41, 7]);
    });

    it('deve trocar as chaves pelos anexos gravados e manter as sem anexo', () => {
      const resultado = substituirReferenciasAnexosNovos(
        descricao,
        new Map([[CHAVE, 99]]),
      );

      expect(resultado).toContain('![print](anexo:99)');
      expect(resultado).toContain('![repetido](anexo:99)');
      expect(resultado).toContain(
        `![outro](anexo-novo:${OUTRA_CHAVE} "título")`,
      );
      expect(resultado).toContain('anexo-novo:ffffffffffffffff fora');
    });

    it('nunca deve aumentar o texto ao trocar as referências', () => {
      const texto = `![a](anexo-novo:${'1'.repeat(8)})`;

      const resultado = substituirReferenciasAnexosNovos(
        texto,
        new Map([['1'.repeat(8), 9_999_999_999_999]]),
      );

      expect(resultado.length).toBeLessThanOrEqual(texto.length);
    });
  });

  describe('ehChaveAnexoNovo', () => {
    it('deve aceitar só letras minúsculas e números, de 8 a 32', () => {
      expect(ehChaveAnexoNovo('abcd1234')).toBe(true);
      expect(ehChaveAnexoNovo('a'.repeat(32))).toBe(true);
      expect(ehChaveAnexoNovo('abc1234')).toBe(false);
      expect(ehChaveAnexoNovo('a'.repeat(33))).toBe(false);
      expect(ehChaveAnexoNovo('ABCD1234')).toBe(false);
      expect(ehChaveAnexoNovo('abcd-1234')).toBe(false);
    });
  });
});
