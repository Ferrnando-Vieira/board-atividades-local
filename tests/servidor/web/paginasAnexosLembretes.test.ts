jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  useRouter: jest.fn(() => ({ push: jest.fn(), refresh: jest.fn() })),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/server', () => ({
  connection: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/servidor/web/bancoAplicacao', () => ({
  CODIGO_BANCO_AUSENTE: 'banco-ausente',
  obterBancoAplicacao: jest.fn(),
}));

import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GET as baixarAnexoAdministrador } from '@/app/anexos/[id]/route';
import { GET as baixarAnexoCompartilhado } from '@/app/compartilhado/[token]/anexos/[id]/route';
import { GET as exibirImagemAdministrador } from '@/app/anexos/[id]/imagem/route';
import { GET as exibirImagemCompartilhada } from '@/app/compartilhado/[token]/anexos/[id]/imagem/route';
import PaginaAparencia from '@/app/aparencia/page';
import PaginaAtividade from '@/app/atividades/[id]/page';
import PaginaAparenciaCompartilhada from '@/app/compartilhado/[token]/aparencia/page';
import { GET as exibirFundoCompartilhado } from '@/app/compartilhado/[token]/fundo/route';
import PaginaAtividadeCompartilhada from '@/app/compartilhado/[token]/atividades/[id]/page';
import PaginaQuadroCompartilhado from '@/app/compartilhado/[token]/page';
import { FUNDOS_BOARD } from '@/config/fundosBoard';
import { montarPrefixoCompartilhamento } from '@/config/rotas';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { textosLembretes } from '@/screens/lembretes/textosLembretes';
import { criarSessao } from '@/servidor/administracao/sessoes';
import { anexarArquivo } from '@/servidor/anexos/anexosServico';
import { editarAtividade } from '@/servidor/atividades/atividadesServico';
import { criarOrigemAlteracao } from '@/servidor/historico/origemAlteracao';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  anexos,
  atividades,
  ID_REGISTRO_UNICO,
} from '@/servidor/banco/esquema';
import { escopoDoLink } from '@/servidor/board/escopoAparencia';
import {
  alterarFundoBoard,
  consultarConfiguracaoFundo,
  salvarImagemFundo,
} from '@/servidor/board/fundoBoard';
import { garantirLinkPadrao } from '@/servidor/compartilhamento/linkPadrao';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  REDIRECIONA_PARA_ENTRADA,
  simularCookieSessao,
} from '@/tests/suporte/acoesServidor';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';
import {
  cadastrarAdministrador,
  criarCenarioEscopo,
  criarLinkDeTeste,
  exigirIdSolicitante,
  exigirIdTag,
  TITULOS_CENARIO,
  type CenarioEscopo,
} from '@/tests/suporte/fabricasCompartilhamento';

const NAO_ENCONTRADO = 'NEXT_NOT_FOUND';
const LEMBRETE_SIGILOSO_UTC = '2026-12-24T13:00:00.000Z';
const DATA_LEMBRETE_SIGILOSO = '24/12/2026';
const NOME_ANEXO_DENTRO = 'fatura de setembro.pdf';
const NOME_ANEXO_FORA = 'ata sigilosa.pdf';
const NOME_IMAGEM_DENTRO = 'tela do erro.png';
const NOME_LINK_EDITOR = 'Equipe financeira';
const ROTULO_BOTAO_CENTRAL = textosLembretes.descreverBotaoCentral(0);

const diretorioAnexos = fs.mkdtempSync(
  path.join(os.tmpdir(), 'board-paginas-anexos-'),
);
process.env.DIRETORIO_ANEXOS = diretorioAnexos;

type BuscaPagina = Record<string, string | string[] | undefined>;

type Pagina<Parametros> = (props: {
  params: Promise<Parametros>;
  searchParams: Promise<BuscaPagina>;
}) => Promise<ReactElement>;

async function renderizar<Parametros>(
  pagina: Pagina<Parametros>,
  parametros: Parametros,
): Promise<string> {
  const elemento = await pagina({
    params: Promise.resolve(parametros),
    searchParams: Promise.resolve({}),
  });
  return renderToStaticMarkup(elemento);
}

function contextoRota(parametros: Record<string, string>) {
  return { params: Promise.resolve(parametros) } as never;
}

describe('páginas com anexos, lembretes e fundo', () => {
  let banco: BancoDados;
  let cenario: CenarioEscopo;
  let anexoDentro: number;
  let anexoFora: number;
  let imagemDentro: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    cenario = criarCenarioEscopo(banco);
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
    simularCookieSessao(undefined);
    anexoDentro = anexarArquivo(banco, diretorioAnexos, {
      atividadeId: cenario.faturasFinanceiro,
      nomeArquivo: NOME_ANEXO_DENTRO,
      conteudo: CONTEUDOS_ANEXO.pdf,
    }).id;
    imagemDentro = anexarArquivo(banco, diretorioAnexos, {
      atividadeId: cenario.faturasFinanceiro,
      nomeArquivo: NOME_IMAGEM_DENTRO,
      conteudo: CONTEUDOS_ANEXO.png,
    }).id;
    anexoFora = anexarArquivo(banco, diretorioAnexos, {
      atividadeId: cenario.outrosEu,
      nomeArquivo: NOME_ANEXO_FORA,
      conteudo: CONTEUDOS_ANEXO.pdf,
    }).id;
    banco
      .update(atividades)
      .set({ lembreteEm: LEMBRETE_SIGILOSO_UTC, lembreteSituacao: 'pendente' })
      .where(eq(atividades.id, cenario.outrosEu))
      .run();
  });

  afterEach(() => {
    fecharBanco(banco);
    for (const nome of fs.readdirSync(diretorioAnexos)) {
      fs.rmSync(path.join(diretorioAnexos, nome), {
        recursive: true,
        force: true,
      });
    }
  });

  afterAll(() => {
    fs.rmSync(diretorioAnexos, { recursive: true, force: true });
  });

  function criarLinkRestrito(): string {
    return criarLinkDeTeste(banco, {
      modalidade: 'restrito',
      tagIds: [exigirIdTag(banco, 'Faturas')],
      solicitanteIds: [exigirIdSolicitante(banco, 'Financeiro')],
    }).token;
  }

  describe('detalhe da atividade', () => {
    it('deve oferecer ao proprietário envio de anexo, remoção e gestão de lembrete', async () => {
      simularCookieSessao(
        criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
      );

      const html = await renderizar(PaginaAtividade, {
        id: String(cenario.outrosEu),
      });

      expect(html).toContain(textosAtividades.rotuloNovoAnexo);
      expect(html).toContain(
        textosAtividades.descreverRemocaoAnexo(NOME_ANEXO_FORA),
      );
      expect(html).toContain(textosAtividades.botaoRemarcarLembrete);
      expect(html).toContain(DATA_LEMBRETE_SIGILOSO);
      expect(html).toContain(ROTULO_BOTAO_CENTRAL);
      expect(html).toContain('href="/aparencia"');
    });

    it('deve oferecer ao link completo anexos, mas nenhum lembrete nem a central', async () => {
      const { token } = criarLinkDeTeste(banco, { modalidade: 'completo' });

      const html = await renderizar(PaginaAtividadeCompartilhada, {
        token,
        id: String(cenario.outrosEu),
      });

      expect(html).toContain(textosAtividades.rotuloNovoAnexo);
      expect(html).not.toContain(textosAtividades.botaoRemarcarLembrete);
      expect(html).not.toContain(DATA_LEMBRETE_SIGILOSO);
      expect(html).not.toContain(ROTULO_BOTAO_CENTRAL);
      // Só a aparência própria do link, nunca a do board.
      expect(html).not.toContain('href="/aparencia"');
      expect(html).toContain(
        `href="${montarPrefixoCompartilhamento(token)}/aparencia"`,
      );
    });

    it('deve mostrar ao link restrito só o download do anexo do escopo', async () => {
      const token = criarLinkRestrito();

      const html = await renderizar(PaginaAtividadeCompartilhada, {
        token,
        id: String(cenario.faturasFinanceiro),
      });

      expect(html).toContain(`/compartilhado/${token}/anexos/${anexoDentro}`);
      expect(html).not.toContain(textosAtividades.rotuloNovoAnexo);
      expect(html).not.toContain(textosAtividades.removerAnexo);
      expect(html).not.toContain(textosAtividades.botaoSalvarLembrete);
      expect(html).not.toContain(textosAtividades.semLembrete);
    });

    it('deve responder ao link restrito como inexistente para card fora do filtro', async () => {
      const token = criarLinkRestrito();

      await expect(
        renderizar(PaginaAtividadeCompartilhada, {
          token,
          id: String(cenario.outrosEu),
        }),
      ).rejects.toThrow(NAO_ENCONTRADO);
    });
  });

  describe('descrição formatada e histórico', () => {
    function editarDescricaoPeloLink(descricao: string): void {
      const atual = banco
        .select({ versao: atividades.versao })
        .from(atividades)
        .where(eq(atividades.id, cenario.faturasFinanceiro))
        .get();
      editarAtividade(
        banco,
        {
          atividadeId: cenario.faturasFinanceiro,
          versaoEsperada: atual?.versao ?? 1,
          titulo: TITULOS_CENARIO.faturasFinanceiro,
          descricao,
          prioridade: 5,
          statusId:
            banco
              .select({ statusId: atividades.statusId })
              .from(atividades)
              .where(eq(atividades.id, cenario.faturasFinanceiro))
              .get()?.statusId ?? 0,
          solicitante: 'Financeiro',
          tags: ['Faturas'],
          prazoData: null,
          prazoHora: null,
          concluidaEmData: null,
          concluidaEmHora: null,
        },
        new Date(),
        criarOrigemAlteracao('link', NOME_LINK_EDITOR),
      );
    }

    it('deve mostrar a descrição formatada com a imagem pela rota do link', async () => {
      editarDescricaoPeloLink(
        '**Importante**\n\n![tela](anexo:' + imagemDentro + ')\n\n<b>texto</b>',
      );
      const token = criarLinkRestrito();

      const html = await renderizar(PaginaAtividadeCompartilhada, {
        token,
        id: String(cenario.faturasFinanceiro),
      });

      expect(html).toContain('<strong>Importante</strong>');
      expect(html).toContain(
        'src="/compartilhado/' + token + '/anexos/' + imagemDentro + '/imagem"',
      );
      expect(html).toContain('&lt;b&gt;texto&lt;/b&gt;');
    });

    it('deve mostrar ao administrador quem alterou, com o nome do link', async () => {
      editarDescricaoPeloLink('Nova descrição');
      simularCookieSessao(
        criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
      );

      const html = await renderizar(PaginaAtividade, {
        id: String(cenario.faturasFinanceiro),
      });

      expect(html).toContain(textosAtividades.rotuloHistorico);
      expect(html).toContain(
        textosAtividades.autoresHistorico.link(NOME_LINK_EDITOR),
      );
      expect(html).toContain(textosAtividades.eventosHistorico.edicao);
    });

    it('não deve revelar ao link o nome de quem alterou', async () => {
      editarDescricaoPeloLink('Nova descrição');
      const token = criarLinkRestrito();

      const html = await renderizar(PaginaAtividadeCompartilhada, {
        token,
        id: String(cenario.faturasFinanceiro),
      });

      expect(html).toContain(textosAtividades.origensHistorico.link);
      expect(html).not.toContain(NOME_LINK_EDITOR);
    });
  });

  describe('quadro do link restrito', () => {
    it('não deve revelar card, anexo ou lembrete fora do filtro', async () => {
      const token = criarLinkRestrito();

      const html = await renderizar(PaginaQuadroCompartilhado, { token });

      expect(html).toContain(TITULOS_CENARIO.faturasFinanceiro);
      expect(html).not.toContain(TITULOS_CENARIO.outrosEu);
      expect(html).not.toContain(NOME_ANEXO_FORA);
      expect(html).not.toContain(DATA_LEMBRETE_SIGILOSO);
      expect(html).not.toContain(ROTULO_BOTAO_CENTRAL);
    });
  });

  describe('download', () => {
    it('deve responder com cabeçalhos seguros e sem revelar o caminho físico', async () => {
      simularCookieSessao(
        criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
      );
      const identificador = banco
        .select({ identificadorArquivo: anexos.identificadorArquivo })
        .from(anexos)
        .where(eq(anexos.id, anexoDentro))
        .get()?.identificadorArquivo;

      const resposta = await baixarAnexoAdministrador(
        new Request('http://127.0.0.1/'),
        contextoRota({ id: String(anexoDentro) }),
      );

      const cabecalhos = [...resposta.headers.entries()];
      expect(resposta.status).toBe(200);
      expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(
        CONTEUDOS_ANEXO.pdf,
      );
      expect(resposta.headers.get('content-type')).toBe(
        'application/octet-stream',
      );
      expect(resposta.headers.get('x-content-type-options')).toBe('nosniff');
      expect(resposta.headers.get('content-security-policy')).toBe(
        "default-src 'none'; sandbox",
      );
      expect(resposta.headers.get('cache-control')).toBe('private, no-store');
      expect(resposta.headers.get('content-disposition')).toMatch(
        /^attachment; /,
      );
      expect(
        cabecalhos.some(
          ([, valor]) =>
            valor.includes(diretorioAnexos) ||
            (identificador !== undefined && valor.includes(identificador)),
        ),
      ).toBe(false);
    });

    it('deve responder 404 ao link restrito para anexo de card fora do filtro', async () => {
      const token = criarLinkRestrito();

      const resposta = await baixarAnexoCompartilhado(
        new Request('http://127.0.0.1/'),
        contextoRota({ token, id: String(anexoFora) }),
      );

      expect(resposta.status).toBe(404);
      expect(await resposta.text()).not.toContain(NOME_ANEXO_FORA);
    });

    it('deve responder 404 depois que o anexo é removido', async () => {
      banco
        .update(anexos)
        .set({ removidoEm: new Date().toISOString() })
        .where(eq(anexos.id, anexoDentro))
        .run();
      const token = criarLinkRestrito();

      const resposta = await baixarAnexoCompartilhado(
        new Request('http://127.0.0.1/'),
        contextoRota({ token, id: String(anexoDentro) }),
      );

      expect(resposta.status).toBe(404);
    });
  });

  describe('imagem do anexo', () => {
    it('deve exibir a imagem com o tipo real e os mesmos cabeçalhos seguros', async () => {
      simularCookieSessao(
        criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
      );

      const resposta = await exibirImagemAdministrador(
        new Request('http://127.0.0.1/'),
        contextoRota({ id: String(imagemDentro) }),
      );

      expect(resposta.status).toBe(200);
      expect(new Uint8Array(await resposta.arrayBuffer())).toEqual(
        CONTEUDOS_ANEXO.png,
      );
      expect(resposta.headers.get('content-type')).toBe('image/png');
      expect(resposta.headers.get('content-disposition')).toMatch(/^inline; /);
      expect(resposta.headers.get('x-content-type-options')).toBe('nosniff');
      expect(resposta.headers.get('content-security-policy')).toBe(
        "default-src 'none'; sandbox",
      );
      expect(resposta.headers.get('cache-control')).toBe('private, no-store');
    });

    it('deve responder 404 para anexo que não é imagem', async () => {
      simularCookieSessao(
        criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
      );

      const resposta = await exibirImagemAdministrador(
        new Request('http://127.0.0.1/'),
        contextoRota({ id: String(anexoDentro) }),
      );

      expect(resposta.status).toBe(404);
    });

    it('deve seguir o escopo do link restrito', async () => {
      const token = criarLinkRestrito();
      const imagemFora = anexarArquivo(banco, diretorioAnexos, {
        atividadeId: cenario.outrosEu,
        nomeArquivo: 'sigilosa.png',
        conteudo: CONTEUDOS_ANEXO.png,
      }).id;

      const dentro = await exibirImagemCompartilhada(
        new Request('http://127.0.0.1/'),
        contextoRota({ token, id: String(imagemDentro) }),
      );
      const fora = await exibirImagemCompartilhada(
        new Request('http://127.0.0.1/'),
        contextoRota({ token, id: String(imagemFora) }),
      );

      expect(dentro.status).toBe(200);
      expect(fora.status).toBe(404);
    });
  });

  describe('fundo do board', () => {
    it('deve aplicar o fundo do board no link nomeado que não personalizou e oferecer a aparência própria', async () => {
      alterarFundoBoard(banco, { fundo: 'gradiente-aurora' });
      const token = criarLinkRestrito();
      const [corInicial] = FUNDOS_BOARD['gradiente-aurora'].cores;

      const html = await renderizar(PaginaQuadroCompartilhado, { token });

      expect(html).toContain(`background-color:${corInicial}`);
      expect(html).toContain('linear-gradient(160deg');
      expect(html).not.toContain('href="/aparencia"');
      expect(html).toContain(
        `href="${montarPrefixoCompartilhamento(token)}/aparencia"`,
      );
    });

    it('deve mostrar ao link a aparência própria, sem afetar o board nem outros links', async () => {
      alterarFundoBoard(banco, { fundo: 'gradiente-aurora' });
      const proprio = criarLinkDeTeste(banco, { modalidade: 'completo' });
      const outro = criarLinkDeTeste(banco, { modalidade: 'completo' });
      alterarFundoBoard(
        banco,
        { fundo: 'cor-menta' },
        undefined,
        escopoDoLink(proprio.linkId),
      );
      const [corMenta] = FUNDOS_BOARD['cor-menta'].cores;
      const [corAurora] = FUNDOS_BOARD['gradiente-aurora'].cores;

      const htmlProprio = await renderizar(PaginaQuadroCompartilhado, {
        token: proprio.token,
      });
      const htmlOutro = await renderizar(PaginaQuadroCompartilhado, {
        token: outro.token,
      });

      expect(htmlProprio).toContain(`background-color:${corMenta}`);
      expect(htmlProprio).not.toContain(`background-color:${corAurora}`);
      expect(htmlOutro).toContain(`background-color:${corAurora}`);
    });

    it('não deve oferecer aparência ao link padrão (público)', async () => {
      const { token } = garantirLinkPadrao(banco, Buffer.alloc(32, 7));

      const html = await renderizar(PaginaQuadroCompartilhado, { token });

      expect(html).not.toContain('/aparencia');
      await expect(
        renderizar(PaginaAparenciaCompartilhada, { token }),
      ).rejects.toThrow(NAO_ENCONTRADO);
    });

    it('deve abrir a tela de aparência própria para um link nomeado', async () => {
      const token = criarLinkRestrito();

      const html = await renderizar(PaginaAparenciaCompartilhada, { token });

      for (const fundo of Object.values(FUNDOS_BOARD)) {
        expect(html).toContain(fundo.rotulo);
      }
      expect(html).toContain('name="tokenCompartilhamento"');
    });

    it('deve servir a cada link só a imagem da aparência que ele exibe', async () => {
      const proprio = criarLinkDeTeste(banco, { modalidade: 'completo' });
      const outro = criarLinkDeTeste(banco, { modalidade: 'completo' });
      salvarImagemFundo(
        banco,
        diretorioAnexos,
        { nomeArquivo: 'meu-fundo.png', conteudo: CONTEUDOS_ANEXO.png },
        escopoDoLink(proprio.linkId),
      );
      const hash = consultarConfiguracaoFundo(
        banco,
        escopoDoLink(proprio.linkId),
      ).imagem?.hash;
      const buscar = (token: string) =>
        exibirFundoCompartilhado(
          new Request(
            `http://localhost/compartilhado/${token}/fundo?v=${hash}`,
          ),
          contextoRota({ token }),
        );

      const doProprio = await buscar(proprio.token);
      const doOutro = await buscar(outro.token);

      expect(doProprio.status).toBe(200);
      expect(doProprio.headers.get('Content-Type')).toBe('image/png');
      expect(doOutro.status).toBe(404);
      await doProprio.body?.cancel();
    });

    it('deve exigir a sessão do proprietário para abrir a tela de aparência', async () => {
      await expect(PaginaAparencia()).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);
    });

    it('deve listar as opções do catálogo para o proprietário', async () => {
      simularCookieSessao(
        criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
      );

      const html = renderToStaticMarkup(await PaginaAparencia());

      for (const fundo of Object.values(FUNDOS_BOARD)) {
        expect(html).toContain(fundo.rotulo);
      }
    });
  });
});
