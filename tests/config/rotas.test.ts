import { LIMITES_TEXTO } from '@/config/constantes';
import {
  aplicarPrefixo,
  lerTermoBusca,
  montarPrefixoCompartilhamento,
  montarRotaAnexo,
  montarRotaAtividade,
  montarRotaAtividadeNoQuadro,
  montarRotaEdicaoAtividade,
  montarRotaNovaAtividade,
  montarUrlCompartilhamento,
  ROTAS,
} from '@/config/rotas';

const TOKEN = 'AbC_123-xyz';
const PREFIXO = `/compartilhado/${TOKEN}`;

describe('rotas', () => {
  describe('aplicarPrefixo', () => {
    it('deve manter a rota do administrador sem prefixo', () => {
      expect(aplicarPrefixo('', ROTAS.ARQUIVADAS)).toBe('/arquivadas');
    });

    it('deve levar o início ao próprio prefixo do link', () => {
      expect(aplicarPrefixo(PREFIXO, ROTAS.INICIO)).toBe(PREFIXO);
    });

    it('deve prefixar as demais rotas do link', () => {
      expect(aplicarPrefixo(PREFIXO, ROTAS.BUSCA)).toBe(`${PREFIXO}/busca`);
    });
  });

  describe('construtores com prefixo', () => {
    it('deve montar as rotas de atividade dentro do link', () => {
      expect(montarRotaAtividade(7, PREFIXO)).toBe(`${PREFIXO}/atividades/7`);
      expect(montarRotaEdicaoAtividade(7, PREFIXO)).toBe(
        `${PREFIXO}/atividades/7/editar`,
      );
      expect(montarRotaNovaAtividade(3, PREFIXO)).toBe(
        `${PREFIXO}/atividades/nova?status=3`,
      );
      expect(montarRotaAnexo(9, PREFIXO)).toBe(`${PREFIXO}/anexos/9`);
      expect(montarRotaAtividadeNoQuadro(7, PREFIXO)).toBe(
        `${PREFIXO}/quadro/atividades/7`,
      );
    });

    it('deve manter as rotas antigas quando não há prefixo', () => {
      expect(montarRotaAtividade(7)).toBe('/atividades/7');
      expect(montarRotaAtividadeNoQuadro(7)).toBe('/quadro/atividades/7');
      expect(montarRotaNovaAtividade()).toBe('/atividades/nova');
    });
  });

  describe('montarPrefixoCompartilhamento', () => {
    it('deve codificar o token para que ele não altere o caminho', () => {
      expect(montarPrefixoCompartilhamento('a/../b')).toBe(
        '/compartilhado/a%2F..%2Fb',
      );
    });
  });

  describe('montarUrlCompartilhamento', () => {
    it('deve usar a URL base da LAN sem barra duplicada', () => {
      expect(
        montarUrlCompartilhamento('http://192.168.0.10:3000/', TOKEN),
      ).toBe(`http://192.168.0.10:3000${PREFIXO}`);
    });
  });

  describe('lerTermoBusca', () => {
    it('deve usar só o primeiro valor de parâmetro repetido, sem espaços nas pontas', () => {
      expect(lerTermoBusca(['  faturas ', 'outro'])).toBe('faturas');
    });

    it('deve devolver texto vazio quando não há parâmetro', () => {
      expect(lerTermoBusca(undefined)).toBe('');
    });

    it('deve cortar termos maiores que o limite', () => {
      const termo = lerTermoBusca('x'.repeat(LIMITES_TEXTO.TERMO_BUSCA + 50));

      expect(termo).toHaveLength(LIMITES_TEXTO.TERMO_BUSCA);
    });
  });
});
