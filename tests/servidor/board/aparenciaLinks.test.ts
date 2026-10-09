import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  consultarAparenciaBoard,
  salvarSuperficies,
} from '@/servidor/board/aparenciaBoard';
import {
  ESCOPO_BOARD,
  escopoDoLink,
  type EscopoAparencia,
} from '@/servidor/board/escopoAparencia';
import {
  abrirImagemFundo,
  alterarFundoBoard,
  consultarConfiguracaoFundo,
  possuiAparenciaPropria,
  resolverDiretorioFundos,
  restaurarAparenciaDoBoard,
  salvarImagemFundo,
} from '@/servidor/board/fundoBoard';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';
import { criarLinkDeTeste } from '@/tests/suporte/fabricasCompartilhamento';

const SUPERFICIES_DO_BOARD = {
  corTitulos: '#101010',
  corColunas: '#202020',
  opacidadeTitulos: 70,
  opacidadeColunas: 60,
  tomTexto: 'claro',
} as const;

const SUPERFICIES_DO_LINK = {
  ...SUPERFICIES_DO_BOARD,
  corColunas: '#abcdef',
} as const;

describe('aparência própria de links nomeados', () => {
  let banco: BancoDados;
  let diretorioAnexos: string;
  let escopo: EscopoAparencia;
  let linkId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    diretorioAnexos = fs.mkdtempSync(path.join(os.tmpdir(), 'board-links-'));
    linkId = criarLinkDeTeste(banco, { modalidade: 'completo' }).linkId;
    escopo = escopoDoLink(linkId);
  });

  afterEach(() => {
    fecharBanco(banco);
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

  function enviarImagem(alvo: EscopoAparencia): void {
    salvarImagemFundo(
      banco,
      diretorioAnexos,
      { nomeArquivo: 'fundo.png', conteudo: CONTEUDOS_ANEXO.png },
      alvo,
    );
  }

  it('sem aparência própria, o link segue a do board', () => {
    alterarFundoBoard(banco, { fundo: 'cor-ceu' });
    salvarSuperficies(banco, SUPERFICIES_DO_BOARD);

    expect(possuiAparenciaPropria(banco, linkId)).toBe(false);
    expect(consultarConfiguracaoFundo(banco, escopo).chavePredefinida).toBe(
      'cor-ceu',
    );
    expect(consultarAparenciaBoard(banco, escopo).superficies).toEqual(
      SUPERFICIES_DO_BOARD,
    );
  });

  it('a primeira alteração copia a aparência do board e muda só o pedido', () => {
    salvarSuperficies(banco, SUPERFICIES_DO_BOARD);

    alterarFundoBoard(banco, { fundo: 'cor-menta' }, diretorioAnexos, escopo);

    expect(possuiAparenciaPropria(banco, linkId)).toBe(true);
    expect(consultarConfiguracaoFundo(banco, escopo).chavePredefinida).toBe(
      'cor-menta',
    );
    expect(consultarAparenciaBoard(banco, escopo).superficies).toEqual(
      SUPERFICIES_DO_BOARD,
    );
    expect(consultarConfiguracaoFundo(banco).chavePredefinida).toBe('padrao');
  });

  it('depois de personalizar, o link não acompanha mudanças do board', () => {
    salvarSuperficies(banco, SUPERFICIES_DO_LINK, escopo);

    salvarSuperficies(banco, SUPERFICIES_DO_BOARD, ESCOPO_BOARD);
    alterarFundoBoard(banco, { fundo: 'gradiente-aurora' });

    expect(consultarAparenciaBoard(banco, escopo).superficies).toEqual(
      SUPERFICIES_DO_LINK,
    );
    expect(consultarConfiguracaoFundo(banco, escopo).chavePredefinida).toBe(
      'padrao',
    );
  });

  it('restaurar apaga a aparência própria e volta a seguir o board', () => {
    alterarFundoBoard(banco, { fundo: 'cor-menta' }, diretorioAnexos, escopo);
    alterarFundoBoard(banco, { fundo: 'cor-ceu' });

    restaurarAparenciaDoBoard(banco, diretorioAnexos, linkId);

    expect(possuiAparenciaPropria(banco, linkId)).toBe(false);
    expect(consultarConfiguracaoFundo(banco, escopo).chavePredefinida).toBe(
      'cor-ceu',
    );
  });

  it('a imagem própria do link fica só nele', () => {
    enviarImagem(escopo);

    expect(consultarConfiguracaoFundo(banco, escopo).tipo).toBe('imagem');
    expect(abrirImagemFundo(banco, diretorioAnexos, escopo)).not.toBeNull();
    expect(consultarConfiguracaoFundo(banco).tipo).toBe('predefinido');
    expect(abrirImagemFundo(banco, diretorioAnexos)).toBeNull();
  });

  it('não apaga a imagem do board que um link copiou, até ninguém mais usá-la', () => {
    enviarImagem(ESCOPO_BOARD);
    salvarSuperficies(banco, SUPERFICIES_DO_LINK, escopo);
    expect(listarArquivosDeFundo()).toHaveLength(1);

    // O board troca de fundo: o arquivo fica, porque o link ainda o mostra.
    alterarFundoBoard(banco, { fundo: 'cor-areia' }, diretorioAnexos);

    expect(listarArquivosDeFundo()).toHaveLength(1);
    expect(abrirImagemFundo(banco, diretorioAnexos, escopo)).not.toBeNull();

    // O link volta ao board: ninguém mais usa a imagem, e ela sai do disco.
    restaurarAparenciaDoBoard(banco, diretorioAnexos, linkId);

    expect(listarArquivosDeFundo()).toEqual([]);
  });

  it('não apaga a imagem do board quando o link copiado troca de fundo', () => {
    enviarImagem(ESCOPO_BOARD);
    salvarSuperficies(banco, SUPERFICIES_DO_LINK, escopo);

    alterarFundoBoard(banco, { fundo: 'cor-menta' }, diretorioAnexos, escopo);

    expect(listarArquivosDeFundo()).toHaveLength(1);
    expect(abrirImagemFundo(banco, diretorioAnexos)).not.toBeNull();
  });

  it('apagar o link apaga a aparência dele (chave estrangeira em cascata)', () => {
    salvarSuperficies(banco, SUPERFICIES_DO_LINK, escopo);

    banco.$client
      .prepare('DELETE FROM links_compartilhamento WHERE id = ?')
      .run(linkId);

    expect(contarLinhas(banco, 'aparencias_link')).toBe(0);
  });
});
