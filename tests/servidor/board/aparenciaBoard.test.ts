import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  CORES_PRIORIDADE_PADRAO,
  SUPERFICIES_PADRAO,
} from '@/config/aparenciaBoard';
import {
  CAMPOS_PRIORIDADES,
  CAMPOS_SUPERFICIES,
} from '@/config/camposFormulario';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  APARENCIA_PADRAO,
  consultarAparenciaBoard,
  esquemaCoresPrioridade,
  esquemaSuperficies,
  montarAparenciaPainel,
  obterAmostrasFundo,
  salvarCoresPrioridade,
  salvarSuperficies,
} from '@/servidor/board/aparenciaBoard';
import {
  alterarFundoBoard,
  consultarConfiguracaoFundo,
  salvarGradientePersonalizado,
  salvarImagemFundo,
} from '@/servidor/board/fundoBoard';
import {
  criarBancoInicializado,
  criarBancoMigrado,
} from '@/tests/suporte/bancoTeste';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';

const SUPERFICIES_ESCURAS = {
  corTitulos: '#111111',
  corColunas: '#1f2937',
  opacidadeTitulos: 80,
  opacidadeColunas: 60,
  tomTexto: 'automatico',
} as const;

const FORMULARIO_SUPERFICIES_VALIDO = {
  [CAMPOS_SUPERFICIES.COR_TITULOS]: '#FFFFFF',
  [CAMPOS_SUPERFICIES.COR_COLUNAS]: ' #f4f6f3 ',
  [CAMPOS_SUPERFICIES.OPACIDADE_TITULOS]: '75',
  [CAMPOS_SUPERFICIES.OPACIDADE_COLUNAS]: '40',
  [CAMPOS_SUPERFICIES.TOM_TEXTO]: 'claro',
};

describe('aparenciaBoard', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  it('deve começar com as superfícies e prioridades padrão', () => {
    expect(consultarAparenciaBoard(banco)).toEqual(APARENCIA_PADRAO);
    expect(APARENCIA_PADRAO.prioridades).toEqual(CORES_PRIORIDADE_PADRAO);
  });

  it('deve devolver o padrão sem board criado', () => {
    const vazio = criarBancoMigrado();

    expect(consultarAparenciaBoard(vazio)).toEqual(APARENCIA_PADRAO);
    fecharBanco(vazio);
  });

  it('deve persistir as superfícies sem trocar o fundo escolhido', () => {
    alterarFundoBoard(banco, { fundo: 'cor-menta' });

    salvarSuperficies(banco, SUPERFICIES_ESCURAS);

    expect(consultarAparenciaBoard(banco).superficies).toEqual(
      SUPERFICIES_ESCURAS,
    );
    expect(consultarConfiguracaoFundo(banco).chavePredefinida).toBe(
      'cor-menta',
    );
  });

  it('deve criar a linha de aparência com o fundo legado quando ela não existe', () => {
    banco.$client.exec("UPDATE boards SET fundo = 'cor-ceu'");
    banco.$client.exec('DELETE FROM fundos_board');

    salvarSuperficies(banco, SUPERFICIES_ESCURAS);

    expect(consultarConfiguracaoFundo(banco).chavePredefinida).toBe('cor-ceu');
  });

  it('deve manter as superfícies ao trocar o fundo depois', () => {
    salvarSuperficies(banco, SUPERFICIES_ESCURAS);

    salvarGradientePersonalizado(banco, {
      formato: 'radial',
      angulo: 90,
      cores: ['#000000', '#222222'],
    });

    expect(consultarAparenciaBoard(banco).superficies).toEqual(
      SUPERFICIES_ESCURAS,
    );
  });

  it('deve persistir as cores das prioridades', () => {
    const cores = {
      critica: '#7048e8',
      alta: '#facc15',
      media: '#ffffff',
      baixa: '#000000',
    };

    salvarCoresPrioridade(banco, cores);

    expect(consultarAparenciaBoard(banco).prioridades).toEqual(cores);
    expect(consultarAparenciaBoard(banco).prioridadesPersonalizadas).toEqual(
      cores,
    );
  });

  describe('esquemaSuperficies', () => {
    it('deve normalizar cores e converter opacidades', () => {
      expect(esquemaSuperficies.parse(FORMULARIO_SUPERFICIES_VALIDO)).toEqual({
        corTitulos: '#ffffff',
        corColunas: '#f4f6f3',
        opacidadeTitulos: 75,
        opacidadeColunas: 40,
        tomTexto: 'claro',
      });
    });

    it.each([
      [CAMPOS_SUPERFICIES.COR_TITULOS, 'red'],
      [CAMPOS_SUPERFICIES.COR_COLUNAS, '#12345'],
      [CAMPOS_SUPERFICIES.OPACIDADE_TITULOS, '101'],
      [CAMPOS_SUPERFICIES.OPACIDADE_COLUNAS, '-5'],
      [CAMPOS_SUPERFICIES.OPACIDADE_COLUNAS, '12.5'],
      [CAMPOS_SUPERFICIES.TOM_TEXTO, 'neon'],
    ])('deve recusar %s = %p', (campo, valor) => {
      const resultado = esquemaSuperficies.safeParse({
        ...FORMULARIO_SUPERFICIES_VALIDO,
        [campo]: valor,
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });
  });

  it('deve recusar cor de prioridade fora do formato', () => {
    const resultado = esquemaCoresPrioridade.safeParse({
      [CAMPOS_PRIORIDADES.critica]: '#b42318',
      [CAMPOS_PRIORIDADES.alta]: 'url(x)',
      [CAMPOS_PRIORIDADES.media]: '#d3e4cf',
      [CAMPOS_PRIORIDADES.baixa]: '#e6e9e4',
    });

    expect(resultado.success).toBe(false);
  });

  describe('obterAmostrasFundo', () => {
    let diretorioAnexos: string;

    beforeEach(() => {
      diretorioAnexos = fs.mkdtempSync(
        path.join(os.tmpdir(), 'board-aparencia-'),
      );
    });

    afterEach(() => {
      fs.rmSync(diretorioAnexos, { recursive: true, force: true });
    });

    it('deve usar as cores do fundo pronto, e a do tema no padrão', () => {
      expect(obterAmostrasFundo(consultarConfiguracaoFundo(banco))).toEqual([
        '#f4f6f3',
      ]);
      alterarFundoBoard(banco, { fundo: 'gradiente-campo' });

      expect(obterAmostrasFundo(consultarConfiguracaoFundo(banco))).toEqual([
        '#edf6e8',
        '#f8f5e4',
      ]);
    });

    it('deve usar as cores do gradiente personalizado', () => {
      salvarGradientePersonalizado(banco, {
        formato: 'linear',
        angulo: 10,
        cores: ['#ff1af7', '#7e67e4'],
      });

      expect(obterAmostrasFundo(consultarConfiguracaoFundo(banco))).toEqual([
        '#ff1af7',
        '#7e67e4',
      ]);
    });

    it('deve usar a cor média da imagem, ou o pior caso sem ela', () => {
      salvarImagemFundo(banco, diretorioAnexos, {
        nomeArquivo: 'noite.png',
        conteudo: CONTEUDOS_ANEXO.png,
        corMedia: '#0A0A2A',
      });
      expect(obterAmostrasFundo(consultarConfiguracaoFundo(banco))).toEqual([
        '#0a0a2a',
      ]);

      salvarImagemFundo(banco, diretorioAnexos, {
        nomeArquivo: 'sem-cor.png',
        conteudo: CONTEUDOS_ANEXO.png,
        corMedia: 'javascript:alert(1)',
      });

      expect(obterAmostrasFundo(consultarConfiguracaoFundo(banco))).toEqual([
        '#000000',
        '#ffffff',
      ]);
    });
  });

  describe('montarAparenciaPainel', () => {
    it('deve gerar as variáveis padrão com texto escuro', () => {
      const painel = montarAparenciaPainel(banco, '');

      expect(painel.colunaPadrao.coluna.tom).toBe('escuro');
      expect(painel.variaveis).toEqual(
        expect.objectContaining({
          '--cor-coluna': SUPERFICIES_PADRAO.corColunas,
          '--opacidade-coluna': '0.9',
          '--cor-prioridade-critica': CORES_PRIORIDADE_PADRAO.critica,
          '--texto-prioridade-critica': '#ffffff',
        }),
      );
    });

    it('deve trocar para texto claro com colunas transparentes sobre fundo escuro', () => {
      salvarGradientePersonalizado(banco, {
        formato: 'linear',
        angulo: 180,
        cores: ['#0b1020', '#1b1f3a'],
      });
      salvarSuperficies(banco, {
        ...SUPERFICIES_PADRAO,
        opacidadeColunas: 10,
        opacidadeTitulos: 0,
      });

      const painel = montarAparenciaPainel(banco, '');

      expect(painel.colunaPadrao.coluna.tom).toBe('claro');
      expect(painel.colunaPadrao.titulo.tom).toBe('claro');
      expect(painel.tomFundo).toBe('claro');
    });
  });
});
