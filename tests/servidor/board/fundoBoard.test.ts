import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LIMITES_IMAGEM_FUNDO } from '@/config/fundosBoard';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  abrirImagemFundo,
  alterarFundoBoard,
  CODIGO_SEM_IMAGEM_FUNDO,
  consultarConfiguracaoFundo,
  consultarFundoBoard,
  esquemaFundoBoard,
  esquemaGradientePersonalizado,
  mensagensFundo,
  montarEstiloFundoConfigurado,
  removerImagemFundo,
  resolverDiretorioFundos,
  salvarGradientePersonalizado,
  salvarImagemFundo,
} from '@/servidor/board/fundoBoard';
import { CODIGO_BOARD_AUSENTE } from '@/servidor/board/boardRepositorio';
import {
  criarBancoInicializado,
  criarBancoMigrado,
} from '@/tests/suporte/bancoTeste';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';

describe('fundoBoard', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  it('deve começar com o fundo padrão do tema', () => {
    expect(consultarFundoBoard(banco)).toBe('padrao');
  });

  it('deve persistir o fundo escolhido', () => {
    alterarFundoBoard(banco, { fundo: 'cor-lavanda' });

    expect(consultarFundoBoard(banco)).toBe('cor-lavanda');
  });

  it('deve permitir voltar ao padrão', () => {
    alterarFundoBoard(banco, { fundo: 'gradiente-campo' });

    alterarFundoBoard(banco, { fundo: 'padrao' });

    expect(consultarFundoBoard(banco)).toBe('padrao');
  });

  it('não deve alterar a versão do board, usada pela configuração de nome e fuso', () => {
    const versaoAntes = banco.$client
      .prepare('SELECT versao FROM boards')
      .pluck()
      .get();

    alterarFundoBoard(banco, { fundo: 'cor-ceu' });

    expect(
      banco.$client.prepare('SELECT versao FROM boards').pluck().get(),
    ).toBe(versaoAntes);
  });

  it.each([
    "url('https://exemplo.invalid/pixel.png')",
    'red',
    '#000000',
    'expression(alert(1))',
  ])('deve ter o valor %p recusado pelo CHECK do banco', (valor) => {
    expect(() =>
      banco.$client.prepare('UPDATE boards SET fundo = ?').run(valor),
    ).toThrow('boards_fundo_valido');
  });

  it('deve recusar no esquema qualquer valor fora do catálogo', () => {
    const resultado = esquemaFundoBoard.safeParse({ fundo: 'url(x)' });

    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(
      mensagensFundo.fundoInvalido,
    );
  });

  it('deve recusar campo ausente no esquema', () => {
    expect(esquemaFundoBoard.safeParse({}).success).toBe(false);
  });

  it('deve aceitar os fundos novos do catálogo, como os radiais e as malhas', () => {
    alterarFundoBoard(banco, { fundo: 'malha-primavera' });

    expect(consultarConfiguracaoFundo(banco)).toEqual(
      expect.objectContaining({
        tipo: 'predefinido',
        chavePredefinida: 'malha-primavera',
      }),
    );
  });

  describe('gradiente personalizado', () => {
    const FORMULARIO_GRADIENTE = {
      formato: 'linear',
      angulo: '45',
      corInicial: '#AABBCC',
      corFinal: '#112233',
    };

    it('deve converter o formulário em gradiente com cores em minúsculas', () => {
      const resultado =
        esquemaGradientePersonalizado.parse(FORMULARIO_GRADIENTE);

      expect(resultado).toEqual({
        formato: 'linear',
        angulo: 45,
        cores: ['#aabbcc', '#112233'],
      });
    });

    it('deve incluir a cor intermediária só com a caixa marcada', () => {
      const comTerceira = esquemaGradientePersonalizado.parse({
        ...FORMULARIO_GRADIENTE,
        usarCorIntermediaria: 'sim',
        corIntermediaria: '#ffffff',
      });
      const semTerceira = esquemaGradientePersonalizado.parse({
        ...FORMULARIO_GRADIENTE,
        corIntermediaria: '#ffffff',
      });

      expect(comTerceira.cores).toEqual(['#aabbcc', '#ffffff', '#112233']);
      expect(semTerceira.cores).toEqual(['#aabbcc', '#112233']);
    });

    it.each([
      ['ângulo acima do limite', { angulo: '400' }, 'angulo'],
      ['ângulo fracionado', { angulo: '10.5' }, 'angulo'],
      ['cor com CSS', { corInicial: 'red; background: url(x)' }, 'corInicial'],
      ['formato desconhecido', { formato: 'conico' }, 'formato'],
    ])('deve recusar %s no campo certo', (_caso, alteracao, campo) => {
      const resultado = esquemaGradientePersonalizado.safeParse({
        ...FORMULARIO_GRADIENTE,
        ...alteracao,
      });

      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues[0]?.path).toEqual([campo]);
    });

    it('deve persistir e aplicar o gradiente, guardando-o ao voltar a um fundo pronto', () => {
      salvarGradientePersonalizado(banco, {
        formato: 'radial',
        angulo: 90,
        cores: ['#101010', '#202020', '#303030'],
      });
      const aplicado = consultarConfiguracaoFundo(banco);
      alterarFundoBoard(banco, { fundo: 'cor-menta' });

      expect(aplicado.tipo).toBe('gradiente');
      expect(montarEstiloFundoConfigurado(aplicado, '')?.backgroundImage).toBe(
        'radial-gradient(ellipse at 100% 50%, #101010, #202020, #303030)',
      );
      expect(consultarConfiguracaoFundo(banco)).toEqual(
        expect.objectContaining({
          tipo: 'predefinido',
          gradiente: {
            formato: 'radial',
            angulo: 90,
            cores: ['#101010', '#202020', '#303030'],
          },
        }),
      );
    });

    it.each([
      ['gradiente_cor_inicial', "'red'"],
      ['gradiente_cor_final', "'#ABCDEF'"],
      ['gradiente_angulo', '361'],
      ['tipo', "'css'"],
      ['chave_predefinida', "'url(x)'"],
    ])('deve ter %s = %s recusado pelo CHECK do banco', (coluna, valor) => {
      alterarFundoBoard(banco, { fundo: 'padrao' });

      expect(() =>
        banco.$client.exec(`UPDATE fundos_board SET ${coluna} = ${valor}`),
      ).toThrow(/CHECK/);
    });
  });

  describe('imagem de fundo', () => {
    let diretorioAnexos: string;

    beforeEach(() => {
      diretorioAnexos = fs.mkdtempSync(path.join(os.tmpdir(), 'board-fundo-'));
    });

    afterEach(() => {
      fs.rmSync(diretorioAnexos, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 50,
      });
    });

    function listarArquivosDeFundo(): string[] {
      const diretorio = resolverDiretorioFundos(diretorioAnexos);
      return fs.existsSync(diretorio) ? fs.readdirSync(diretorio) : [];
    }

    it('deve gravar a imagem fora de public, aplicá-la e servi-la com o tipo do catálogo', async () => {
      salvarImagemFundo(banco, diretorioAnexos, {
        nomeArquivo: 'paisagem.PNG',
        conteudo: CONTEUDOS_ANEXO.png,
      });

      const configuracao = consultarConfiguracaoFundo(banco);
      const arquivo = abrirImagemFundo(banco, diretorioAnexos);
      const bytes = arquivo
        ? new Uint8Array(
            await new Response(arquivo.conteudo.fluxo).arrayBuffer(),
          )
        : null;

      expect(configuracao.tipo).toBe('imagem');
      expect(listarArquivosDeFundo()).toHaveLength(1);
      expect(arquivo?.tipoConteudo).toBe('image/png');
      expect(arquivo?.hash).toBe(configuracao.imagem?.hash);
      expect(bytes).toEqual(CONTEUDOS_ANEXO.png);
      expect(
        montarEstiloFundoConfigurado(configuracao, '/compartilhado/abc')
          ?.backgroundImage,
      ).toBe(`url("/compartilhado/abc/fundo?v=${configuracao.imagem?.hash}")`);
    });

    it('deve trocar a imagem e apagar a anterior do disco', () => {
      salvarImagemFundo(banco, diretorioAnexos, {
        nomeArquivo: 'primeira.png',
        conteudo: CONTEUDOS_ANEXO.png,
      });

      salvarImagemFundo(banco, diretorioAnexos, {
        nomeArquivo: 'segunda.jpg',
        conteudo: CONTEUDOS_ANEXO.jpeg,
      });

      expect(listarArquivosDeFundo()).toHaveLength(1);
      expect(consultarConfiguracaoFundo(banco).imagem?.formato).toBe('jpeg');
    });

    it.each([
      [
        'GIF animável',
        'anima.gif',
        CONTEUDOS_ANEXO.gif,
        'tipo-arquivo-nao-permitido',
      ],
      [
        'PDF',
        'documento.pdf',
        CONTEUDOS_ANEXO.pdf,
        'tipo-arquivo-nao-permitido',
      ],
      [
        'executável renomeado',
        'foto.png',
        CONTEUDOS_ANEXO.executavel,
        'conteudo-incompativel',
      ],
    ])(
      'deve recusar %s sem gravar nada',
      (_caso, nomeArquivo, conteudo, codigo) => {
        expect(() =>
          salvarImagemFundo(banco, diretorioAnexos, { nomeArquivo, conteudo }),
        ).toThrow(expect.objectContaining({ codigo }));

        expect(listarArquivosDeFundo()).toEqual([]);
        expect(consultarConfiguracaoFundo(banco).tipo).toBe('predefinido');
      },
    );

    it('deve recusar imagem acima do limite', () => {
      const grande = new Uint8Array(
        LIMITES_IMAGEM_FUNDO.TAMANHO_MAXIMO_BYTES + 1,
      );
      grande.set(CONTEUDOS_ANEXO.png);

      expect(() =>
        salvarImagemFundo(banco, diretorioAnexos, {
          nomeArquivo: 'grande.png',
          conteudo: grande,
        }),
      ).toThrow(expect.objectContaining({ codigo: 'arquivo-grande-demais' }));
    });

    it('deve remover a imagem, apagar o arquivo e voltar ao fundo padrão', () => {
      salvarImagemFundo(banco, diretorioAnexos, {
        nomeArquivo: 'paisagem.webp',
        conteudo: CONTEUDOS_ANEXO.webp,
      });

      removerImagemFundo(banco, diretorioAnexos);

      expect(listarArquivosDeFundo()).toEqual([]);
      expect(consultarConfiguracaoFundo(banco)).toEqual(
        expect.objectContaining({
          tipo: 'predefinido',
          chavePredefinida: 'padrao',
          imagem: null,
        }),
      );
      expect(abrirImagemFundo(banco, diretorioAnexos)).toBeNull();
    });

    it('deve descartar a imagem ao escolher outro fundo', () => {
      salvarImagemFundo(banco, diretorioAnexos, {
        nomeArquivo: 'paisagem.png',
        conteudo: CONTEUDOS_ANEXO.png,
      });

      alterarFundoBoard(banco, { fundo: 'cor-areia' }, diretorioAnexos);

      expect(listarArquivosDeFundo()).toEqual([]);
      expect(consultarConfiguracaoFundo(banco).imagem).toBeNull();
    });

    it('deve recusar remover quando não há imagem', () => {
      expect(() => removerImagemFundo(banco, diretorioAnexos)).toThrow(
        expect.objectContaining({ codigo: CODIGO_SEM_IMAGEM_FUNDO }),
      );
    });
  });

  describe('sem board inicializado', () => {
    let bancoVazio: BancoDados;

    beforeEach(() => {
      bancoVazio = criarBancoMigrado();
    });

    afterEach(() => {
      fecharBanco(bancoVazio);
    });

    it('deve consultar o padrão', () => {
      expect(consultarFundoBoard(bancoVazio)).toBe('padrao');
    });

    it('deve recusar a alteração', () => {
      expect(() =>
        alterarFundoBoard(bancoVazio, { fundo: 'cor-menta' }),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_BOARD_AUSENTE }));
    });
  });
});
