import fs from 'node:fs';
import path from 'node:path';
import {
  CORES_PRIORIDADE_PADRAO,
  CORES_SUGERIDAS_PRIORIDADE,
  NIVEIS_PRIORIDADE,
} from '@/config/aparenciaBoard';
import { CORES_SUGERIDAS_TAG } from '@/config/coresTags';
import {
  calcularContraste,
  calcularCorMedia,
  classificarLeitura,
  CONTRASTE_MINIMO_AA,
  CORES_TEXTO_POR_TOM,
  corTextoSobre,
  ehCorHexadecimal,
  escolherTomTexto,
  escurecer,
  lerCanais,
  luminanciaRelativa,
  sobrepor,
} from '@/util/CorUtils';

const CAMINHO_TEMA = path.join(process.cwd(), 'app', 'globals.css');

function lerTokenTema(nome: string): string | undefined {
  const css = fs.readFileSync(CAMINHO_TEMA, 'utf8');
  return new RegExp(`--color-${nome}:\\s*(#[0-9a-f]{6});`).exec(css)?.[1];
}

describe('CorUtils', () => {
  describe('ehCorHexadecimal', () => {
    it.each(['#000000', '#a1b2c3'])('deve aceitar %s', (cor) => {
      expect(ehCorHexadecimal(cor)).toBe(true);
    });

    it.each(['#FFF', '#ABCDEF', 'red', '', null, '#12345g', 'url(x)'])(
      'deve recusar %p',
      (cor) => {
        expect(ehCorHexadecimal(cor)).toBe(false);
      },
    );
  });

  it('deve ler os canais em decimal', () => {
    expect(lerCanais('#ff8000')).toEqual([255, 128, 0]);
  });

  it('deve calcular a luminância dos extremos', () => {
    expect(luminanciaRelativa('#000000')).toBe(0);
    expect(luminanciaRelativa('#ffffff')).toBeCloseTo(1);
  });

  it('deve dar contraste 21 entre preto e branco, em qualquer ordem', () => {
    expect(calcularContraste('#000000', '#ffffff')).toBeCloseTo(21);
    expect(calcularContraste('#ffffff', '#000000')).toBeCloseTo(21);
  });

  it('deve misturar a superfície ao fundo pela opacidade', () => {
    expect(sobrepor('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(sobrepor('#ffffff', '#000000', 1)).toBe('#ffffff');
    expect(sobrepor('#ffffff', '#000000', 0)).toBe('#000000');
  });

  it('deve escurecer mantendo o formato', () => {
    expect(escurecer('#ffffff', 0.5)).toBe('#808080');
  });

  describe('escolherTomTexto', () => {
    it('deve escolher texto escuro sobre superfície clara quase opaca', () => {
      expect(escolherTomTexto(['#000000'], '#ffffff', 0.95).tom).toBe('escuro');
    });

    it('deve escolher texto claro quando a superfície transparente deixa o fundo escuro', () => {
      const escolha = escolherTomTexto(['#ff1af7', '#7e67e4'], '#ffffff', 0.1);

      expect(escolha.tom).toBe('claro');
      expect(escolha.coresEfetivas).toHaveLength(2);
    });

    it('deve escolher texto claro sobre superfície escura', () => {
      expect(escolherTomTexto(['#ffffff'], '#111111', 0.9).tom).toBe('claro');
    });

    it('deve considerar o pior ponto de um gradiente', () => {
      const escolha = escolherTomTexto(['#ffffff', '#000000'], '#ffffff', 0);

      expect(escolha.contraste).toBeLessThan(CONTRASTE_MINIMO_AA);
    });

    it('deve respeitar o tom forçado e informar o contraste resultante', () => {
      const escolha = escolherTomTexto(['#ffffff'], '#ffffff', 1, 'claro');

      expect(escolha.tom).toBe('claro');
      expect(escolha.contraste).toBeCloseTo(1);
    });
  });

  it.each([
    [21, 'boa'],
    [4.5, 'boa'],
    [3.2, 'atencao'],
    [1.5, 'dificil'],
  ] as const)('deve classificar contraste %d como %s', (contraste, nivel) => {
    expect(classificarLeitura(contraste)).toBe(nivel);
  });

  it('deve usar nas contas as mesmas cores de texto do tema', () => {
    expect(CORES_TEXTO_POR_TOM.escuro).toEqual({
      principal: lerTokenTema('texto'),
      suave: lerTokenTema('texto-suave'),
    });
    expect(CORES_TEXTO_POR_TOM.claro).toEqual({
      principal: lerTokenTema('texto-claro'),
      suave: lerTokenTema('texto-claro-suave'),
    });
  });

  describe('corTextoSobre', () => {
    const coresSolidas = [
      ...CORES_SUGERIDAS_TAG,
      ...CORES_SUGERIDAS_PRIORIDADE,
      ...NIVEIS_PRIORIDADE.map((nivel) => ({
        cor: CORES_PRIORIDADE_PADRAO[nivel],
        nome: nivel,
      })),
    ].map(({ cor, nome }) => [nome, cor] as const);

    it.each(coresSolidas)(
      'deve manter AA no texto sobre a cor sugerida %s (%s)',
      (_nome, cor) => {
        expect(
          calcularContraste(corTextoSobre(cor), cor),
        ).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
      },
    );
  });
});

describe('calcularCorMedia', () => {
  it('deve tirar a média dos pixels visíveis', () => {
    const pixels = [255, 0, 0, 255, 0, 0, 255, 255];

    expect(calcularCorMedia(pixels)).toBe('#800080');
  });

  it('deve ignorar pixels transparentes', () => {
    const pixels = [255, 255, 255, 0, 10, 20, 30, 255];

    expect(calcularCorMedia(pixels)).toBe('#0a141e');
  });

  it('deve devolver nulo sem pixel visível', () => {
    expect(calcularCorMedia([1, 2, 3, 0])).toBeNull();
    expect(calcularCorMedia([])).toBeNull();
  });
});
