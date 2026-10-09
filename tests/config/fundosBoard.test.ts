import fs from 'node:fs';
import path from 'node:path';
import { LIMITES_ANEXO } from '@/config/anexos';
import { SUPERFICIES_PADRAO } from '@/config/aparenciaBoard';
import {
  calcularCentroRadial,
  CHAVES_FUNDO_BOARD,
  CHAVES_FUNDO_LEGADO,
  COR_FUNDO_TEMA,
  ehChaveFundoBoard,
  FUNDOS_BOARD,
  montarEstiloFundoBoard,
  montarEstiloGradientePersonalizado,
  montarEstiloImagemFundo,
  obterCoresFundoBoard,
} from '@/config/fundosBoard';
import configuracaoNext from '@/next.config';
import {
  calcularContraste,
  CONTRASTE_MINIMO_AA,
  sobrepor,
} from '@/util/CorUtils';

// Superfícies padrão (Aparência) sobre o fundo do board: corpo das colunas e,
// por cima dele, os títulos.
const SUPERFICIE_COLUNA = {
  cor: SUPERFICIES_PADRAO.corColunas,
  opacidade: SUPERFICIES_PADRAO.opacidadeColunas / 100,
};
const SUPERFICIE_TITULO = {
  cor: SUPERFICIES_PADRAO.corTitulos,
  opacidade: SUPERFICIES_PADRAO.opacidadeTitulos / 100,
};
const FORMATO_COR = /^#[0-9a-f]{6}$/;
const CAMINHO_TEMA = path.join(process.cwd(), 'app', 'globals.css');
const DIRETORIO_MIGRACOES = path.join(
  process.cwd(),
  'servidor',
  'banco',
  'migracoes',
);
const CAMINHO_MIGRACAO_LEGADO = path.join(
  DIRETORIO_MIGRACOES,
  '0002_anexos_fundo_lembretes.sql',
);
const CAMINHO_MIGRACAO_CATALOGO = path.join(
  DIRETORIO_MIGRACOES,
  '0003_fundos_link_padrao.sql',
);
const TOKENS_TEXTO = ['texto', 'texto-suave', 'primaria'] as const;

function lerTokenTema(nome: string): string {
  const css = fs.readFileSync(CAMINHO_TEMA, 'utf8');
  const valor = new RegExp(`--color-${nome}:\\s*(#[0-9a-f]{6});`).exec(
    css,
  )?.[1];
  if (!valor) {
    throw new Error(`Token --color-${nome} ausente do tema.`);
  }
  return valor;
}

const CORES_DOS_FUNDOS = CHAVES_FUNDO_BOARD.flatMap((chave) =>
  FUNDOS_BOARD[chave].cores.map((cor): [string, string] => [chave, cor]),
);

describe('catálogo de fundos do board', () => {
  it.each(CORES_DOS_FUNDOS)(
    'deve usar só cor hexadecimal fixa em %s (%s)',
    (_chave, cor) => {
      expect(cor).toMatch(FORMATO_COR);
    },
  );

  describe.each(TOKENS_TEXTO)('contraste do token %s', (token) => {
    it.each(CORES_DOS_FUNDOS)(
      'deve manter AA sobre o fundo %s (%s)',
      (_chave, cor) => {
        const contraste = calcularContraste(lerTokenTema(token), cor);

        expect(contraste).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
      },
    );

    it.each(CORES_DOS_FUNDOS)(
      'deve manter AA dentro das colunas sobre o fundo %s (%s)',
      (_chave, cor) => {
        const fundoColuna = sobrepor(
          SUPERFICIE_COLUNA.cor,
          cor,
          SUPERFICIE_COLUNA.opacidade,
        );

        const contraste = calcularContraste(lerTokenTema(token), fundoColuna);

        expect(contraste).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
      },
    );

    it.each(CORES_DOS_FUNDOS)(
      'deve manter AA nos títulos das colunas sobre o fundo %s (%s)',
      (_chave, cor) => {
        const fundoTitulo = sobrepor(
          SUPERFICIE_TITULO.cor,
          sobrepor(SUPERFICIE_COLUNA.cor, cor, SUPERFICIE_COLUNA.opacidade),
          SUPERFICIE_TITULO.opacidade,
        );

        const contraste = calcularContraste(lerTokenTema(token), fundoTitulo);

        expect(contraste).toBeGreaterThanOrEqual(CONTRASTE_MINIMO_AA);
      },
    );
  });

  it('deve usar como fundo do padrão a mesma cor do token do tema', () => {
    expect(COR_FUNDO_TEMA).toBe(lerTokenTema('fundo'));
    expect(obterCoresFundoBoard('padrao')).toEqual([COR_FUNDO_TEMA]);
    expect(obterCoresFundoBoard('gradiente-oceano')).toEqual(
      FUNDOS_BOARD['gradiente-oceano'].cores,
    );
  });

  it('deve usar como cor padrão das colunas o fundo do tema', () => {
    expect(SUPERFICIES_PADRAO.corColunas).toBe(lerTokenTema('fundo'));
    expect(SUPERFICIES_PADRAO.corTitulos).toBe(lerTokenTema('superficie'));
  });

  describe('montarEstiloFundoBoard', () => {
    it('não deve gerar estilo para o padrão, que usa o fundo do tema', () => {
      expect(montarEstiloFundoBoard('padrao')).toBeUndefined();
    });

    it('deve gerar cor sólida para as opções de uma cor', () => {
      expect(montarEstiloFundoBoard('cor-menta')).toEqual({
        backgroundColor: FUNDOS_BOARD['cor-menta'].cores[0],
      });
    });

    it('deve gerar gradiente com cor de reserva para as opções de duas cores', () => {
      const [inicial, final] = FUNDOS_BOARD['gradiente-oceano'].cores;

      expect(montarEstiloFundoBoard('gradiente-oceano')).toEqual({
        backgroundColor: inicial,
        backgroundImage: `linear-gradient(160deg, ${inicial}, ${final})`,
      });
    });

    it('deve gerar gradiente radial para as opções radiais', () => {
      const [centro, borda] = FUNDOS_BOARD['radial-luar'].cores;

      expect(montarEstiloFundoBoard('radial-luar')).toEqual({
        backgroundColor: centro,
        backgroundImage: `radial-gradient(ellipse at top, ${centro}, ${borda})`,
      });
    });

    it('deve sobrepor uma mancha radial por cor na malha, sobre a cor de base', () => {
      const [base, ...manchas] = FUNDOS_BOARD['malha-primavera'].cores;

      const estilo = montarEstiloFundoBoard('malha-primavera');

      expect(estilo?.backgroundColor).toBe(base);
      expect(estilo?.backgroundImage?.match(/radial-gradient/g)).toHaveLength(
        manchas.length,
      );
    });
  });

  describe('montarEstiloGradientePersonalizado', () => {
    it('deve montar gradiente linear com o ângulo escolhido', () => {
      expect(
        montarEstiloGradientePersonalizado({
          formato: 'linear',
          angulo: 45,
          cores: ['#112233', '#445566', '#778899'],
        }),
      ).toEqual({
        backgroundColor: '#112233',
        backgroundImage: 'linear-gradient(45deg, #112233, #445566, #778899)',
      });
    });

    it.each([
      [0, 'ellipse at 50% 0%'],
      [90, 'ellipse at 100% 50%'],
      [180, 'ellipse at 50% 100%'],
      [270, 'ellipse at 0% 50%'],
      [360, 'ellipse at 50% 0%'],
      [45, 'ellipse at 85% 15%'],
    ])('deve posicionar a luz do radial pelo ângulo %d°', (angulo, centro) => {
      expect(calcularCentroRadial(angulo)).toBe(centro);
      expect(
        montarEstiloGradientePersonalizado({
          formato: 'radial',
          angulo,
          cores: ['#112233', '#445566'],
        })?.backgroundImage,
      ).toBe(`radial-gradient(${centro}, #112233, #445566)`);
    });

    it.each([
      ['cor fora do formato', { angulo: 90, cores: ['red', '#445566'] }],
      [
        'injeção de CSS',
        { angulo: 90, cores: ['#112233); x: url(a', '#445566'] },
      ],
      ['uma cor só', { angulo: 90, cores: ['#112233'] }],
      ['cores demais', { angulo: 90, cores: Array(4).fill('#112233') }],
      [
        'ângulo fora do intervalo',
        { angulo: 361, cores: ['#112233', '#445566'] },
      ],
      ['ângulo fracionado', { angulo: 1.5, cores: ['#112233', '#445566'] }],
    ])('não deve gerar estilo com %s', (_caso, gradiente) => {
      expect(
        montarEstiloGradientePersonalizado({ formato: 'linear', ...gradiente }),
      ).toBeUndefined();
    });
  });

  describe('montarEstiloImagemFundo', () => {
    it('deve cobrir e centralizar a imagem servida por rota interna', () => {
      expect(montarEstiloImagemFundo(`/fundo?v=${'a'.repeat(64)}`)).toEqual({
        backgroundImage: `url("/fundo?v=${'a'.repeat(64)}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      });
    });

    it.each([
      'https://exemplo.com/imagem.png?v=abc',
      'javascript:alert(1)',
      '/fundo?v=abc")',
      '/fundo',
    ])('deve recusar o endereço %p', (endereco) => {
      expect(montarEstiloImagemFundo(endereco)).toBeUndefined();
    });
  });

  describe('ehChaveFundoBoard', () => {
    it.each(['url(x)', 'Padrao', '', null, 1, '__proto__', 'constructor'])(
      'deve recusar %p',
      (valor) => {
        expect(ehChaveFundoBoard(valor)).toBe(false);
      },
    );

    it('deve aceitar as chaves do catálogo', () => {
      expect(CHAVES_FUNDO_BOARD.every(ehChaveFundoBoard)).toBe(true);
    });
  });

  function lerListaDoCheck(caminho: string, coluna: string): string[] {
    const sql = fs.readFileSync(caminho, 'utf8');
    const lista =
      new RegExp(
        `CHECK\\("(?:fundos_board"\\.")?${coluna}" IN \\(([^)]*)\\)\\)`,
      ).exec(sql)?.[1] ?? '';
    return lista.split(',').map((item) => item.trim().replace(/'/g, ''));
  }

  it('deve manter na coluna legada exatamente as chaves do CHECK da migração 0002', () => {
    expect(lerListaDoCheck(CAMINHO_MIGRACAO_LEGADO, 'fundo')).toEqual(
      CHAVES_FUNDO_LEGADO,
    );
  });

  it('deve ter exatamente as mesmas chaves do CHECK da migração 0003', () => {
    expect(
      lerListaDoCheck(CAMINHO_MIGRACAO_CATALOGO, 'chave_predefinida'),
    ).toEqual(CHAVES_FUNDO_BOARD);
  });

  it('deve manter todas as chaves legadas no catálogo atual', () => {
    expect(CHAVES_FUNDO_LEGADO.every(ehChaveFundoBoard)).toBe(true);
  });
});

describe('limite de corpo das Server Actions', () => {
  it('deve comportar o maior envio de anexos mais a margem do multipart', () => {
    const limite = configuracaoNext.experimental?.serverActions?.bodySizeLimit;

    expect(limite).toBe(
      LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES +
        LIMITES_ANEXO.MARGEM_CORPO_ENVIO_BYTES,
    );
  });

  it('deve permitir no envio pelo menos um anexo do tamanho máximo', () => {
    expect(LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES).toBeGreaterThanOrEqual(
      LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES,
    );
  });
});
