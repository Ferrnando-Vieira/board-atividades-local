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

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cookies } from 'next/headers';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GET as baixarAnexoAdministrador } from '@/app/anexos/[id]/route';
import { GET as baixarAnexoCompartilhado } from '@/app/compartilhado/[token]/anexos/[id]/route';
import ModalAtividadeCompartilhada from '@/app/compartilhado/[token]/@modal/(.)quadro/atividades/[id]/page';
import PaginaArquivadasCompartilhadas from '@/app/compartilhado/[token]/arquivadas/page';
import PaginaEdicaoAtividadeCompartilhada from '@/app/compartilhado/[token]/atividades/[id]/editar/page';
import PaginaAtividadeCompartilhada from '@/app/compartilhado/[token]/atividades/[id]/page';
import PaginaNovaAtividadeCompartilhada from '@/app/compartilhado/[token]/atividades/nova/page';
import PaginaBuscaCompartilhada from '@/app/compartilhado/[token]/busca/page';
import PaginaQuadroCompartilhado from '@/app/compartilhado/[token]/page';
import PaginaAtividadeNoQuadroCompartilhada from '@/app/compartilhado/[token]/quadro/atividades/[id]/page';
import PaginaStatusCompartilhado from '@/app/compartilhado/[token]/status/page';
import PaginaTagsCompartilhadas from '@/app/compartilhado/[token]/tags/page';
import PaginaInicial from '@/app/page';
import { SESSAO_ADMINISTRATIVA } from '@/config/constantesSeguranca';
import { criarSessao } from '@/servidor/administracao/sessoes';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { ID_REGISTRO_UNICO } from '@/servidor/banco/esquema';
import { revogarLinkCompartilhamento } from '@/servidor/compartilhamento/linksServico';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import {
  cadastrarAdministrador,
  criarCenarioEscopo,
  criarLinkDeTeste,
  exigirIdSolicitante,
  exigirIdTag,
  inserirAnexo,
  TITULOS_CENARIO,
  type CenarioEscopo,
} from '@/tests/suporte/fabricasCompartilhamento';

type ArmazenamentoCookies = Awaited<ReturnType<typeof cookies>>;

const NAO_ENCONTRADO = 'NEXT_NOT_FOUND';
const INDISPONIVEL = 'NEXT_REDIRECT:/compartilhado';
const CONTEUDO_ANEXO = 'PDF!';
const ID_ARQUIVO_DENTRO = 'anexo-dentro-escopo-01';
const ID_ARQUIVO_FORA = 'anexo-fora-escopo-0001';
const TEXTO_ALCA = 'Mover a atividade';
const TEXTO_COMPARTILHAR = 'Compartilhar board';
const TEXTO_NOVA_ATIVIDADE = 'Nova atividade';

const diretorioAnexos = fs.mkdtempSync(
  path.join(os.tmpdir(), 'board-anexos-teste-'),
);
process.env.DIRETORIO_ANEXOS = diretorioAnexos;

function simularCookie(token: string | undefined): void {
  const armazenamento = {
    get: (nome: string) =>
      token !== undefined && nome === SESSAO_ADMINISTRATIVA.NOME_COOKIE
        ? { name: nome, value: token }
        : undefined,
  };
  jest
    .mocked(cookies)
    .mockResolvedValue(armazenamento as unknown as ArmazenamentoCookies);
}

type ParametrosPagina = Record<string, string>;

type BuscaPagina = Record<string, string | string[] | undefined>;

type Pagina<Parametros> = (props: {
  params: Promise<Parametros>;
  searchParams: Promise<BuscaPagina>;
}) => Promise<ReactElement>;

async function renderizar<Parametros>(
  pagina: Pagina<Parametros>,
  parametros: Parametros,
  busca: BuscaPagina = {},
): Promise<string> {
  const elemento = await pagina({
    params: Promise.resolve(parametros),
    searchParams: Promise.resolve(busca),
  });
  return renderToStaticMarkup(elemento);
}

function contextoRota(parametros: ParametrosPagina) {
  return { params: Promise.resolve(parametros) } as never;
}

describe('páginas do link compartilhado', () => {
  let banco: BancoDados;
  let cenario: CenarioEscopo;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    cenario = criarCenarioEscopo(banco);
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
    simularCookie(undefined);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  afterAll(() => {
    fs.rmSync(diretorioAnexos, { recursive: true, force: true });
  });

  function criarLinkRestrito(incluirArquivadas = false): string {
    return criarLinkDeTeste(banco, {
      nome: 'Time financeiro',
      tagIds: [exigirIdTag(banco, 'Faturas')],
      solicitanteIds: [exigirIdSolicitante(banco, 'Financeiro')],
      incluirArquivadas,
    }).token;
  }

  function criarLinkCompleto(): string {
    return criarLinkDeTeste(banco, {
      nome: 'Equipe',
      modalidade: 'completo',
      incluirArquivadas: true,
    }).token;
  }

  describe('modalidade restrita', () => {
    it('deve renderizar no quadro só os cartões do escopo, sem controles de edição', async () => {
      const token = criarLinkRestrito();

      const html = await renderizar(PaginaQuadroCompartilhado, { token });

      expect(html).toContain(TITULOS_CENARIO.faturasFinanceiro);
      expect(html).not.toContain(TITULOS_CENARIO.faturasBugsEu);
      expect(html).not.toContain(TITULOS_CENARIO.bugsFinanceiro);
      expect(html).not.toContain(TITULOS_CENARIO.semTagsFinanceiro);
      expect(html).not.toContain(TITULOS_CENARIO.outrosEu);
      expect(html).not.toContain(TITULOS_CENARIO.arquivadaFaturasFinanceiro);
      expect(html).not.toContain('Diretoria');
      expect(html).not.toContain(TEXTO_ALCA);
      expect(html).not.toContain('Nova atividade');
      expect(html).not.toContain(TEXTO_COMPARTILHAR);
      expect(html).not.toContain('Integrações');
      expect(html).not.toContain('>Status<');
      expect(html).toContain('Somente leitura');
      expect(html).toContain(
        `href="/compartilhado/${token}/quadro/atividades/${cenario.faturasFinanceiro}"`,
      );
    });

    it('deve abrir o detalhe do cartão em modal, com o escopo do link', async () => {
      const token = criarLinkRestrito();

      const html = await renderizar(ModalAtividadeCompartilhada, {
        token,
        id: String(cenario.faturasFinanceiro),
      });

      expect(html).toContain('<dialog');
      expect(html).toContain(TITULOS_CENARIO.faturasFinanceiro);
      expect(html).not.toContain('Voltar ao quadro');
      await expect(
        renderizar(ModalAtividadeCompartilhada, {
          token,
          id: String(cenario.outrosEu),
        }),
      ).rejects.toThrow(NAO_ENCONTRADO);
    });

    it('deve levar o endereço do cartão aberto direto à página completa', async () => {
      const token = criarLinkRestrito();
      const id = String(cenario.faturasFinanceiro);

      await expect(
        renderizar(PaginaAtividadeNoQuadroCompartilhada, { token, id }),
      ).rejects.toThrow(
        `NEXT_REDIRECT:/compartilhado/${token}/atividades/${id}`,
      );
      await expect(
        renderizar(PaginaAtividadeNoQuadroCompartilhada, { token, id: '1e3' }),
      ).rejects.toThrow(NAO_ENCONTRADO);
    });

    it('deve responder 404 ao detalhe fora do escopo digitado na URL', async () => {
      const token = criarLinkRestrito();

      await expect(
        renderizar(PaginaAtividadeCompartilhada, {
          token,
          id: String(cenario.outrosEu),
        }),
      ).rejects.toThrow(NAO_ENCONTRADO);
    });

    it('deve mostrar o detalhe do escopo sem editar nem arquivar', async () => {
      const token = criarLinkRestrito();

      const html = await renderizar(PaginaAtividadeCompartilhada, {
        token,
        id: String(cenario.faturasFinanceiro),
      });

      expect(html).toContain(TITULOS_CENARIO.faturasFinanceiro);
      expect(html).not.toContain('Editar');
      expect(html).not.toContain('Arquivar');
      expect(html).not.toContain('tokenCompartilhamento');
    });

    it.each([
      [
        'edição',
        (token: string, atividadeId: number) =>
          renderizar(PaginaEdicaoAtividadeCompartilhada, {
            token,
            id: String(atividadeId),
          }),
      ],
      [
        'nova atividade',
        (token: string) =>
          renderizar(PaginaNovaAtividadeCompartilhada, { token }),
      ],
      [
        'status',
        (token: string) => renderizar(PaginaStatusCompartilhado, { token }),
      ],
      [
        'tags',
        (token: string) => renderizar(PaginaTagsCompartilhadas, { token }),
      ],
    ])('deve responder 404 à tela de %s', async (_nome, abrir) => {
      const token = criarLinkRestrito();

      await expect(abrir(token, cenario.faturasFinanceiro)).rejects.toThrow(
        NAO_ENCONTRADO,
      );
    });

    it('deve esconder arquivadas quando o link não as inclui', async () => {
      const token = criarLinkRestrito(false);

      await expect(
        renderizar(PaginaArquivadasCompartilhadas, { token }),
      ).rejects.toThrow(NAO_ENCONTRADO);
    });

    it('deve listar só as arquivadas do escopo quando o link as inclui', async () => {
      const token = criarLinkRestrito(true);

      const html = await renderizar(PaginaArquivadasCompartilhadas, { token });

      expect(html).toContain(TITULOS_CENARIO.arquivadaFaturasFinanceiro);
      expect(html).not.toContain('Restaurar');
    });

    it('deve buscar só dentro do escopo', async () => {
      const token = criarLinkRestrito();

      const foraDoEscopo = await renderizar(
        PaginaBuscaCompartilhada,
        { token },
        { q: 'reunião sigilosa' },
      );
      const dentroDoEscopo = await renderizar(
        PaginaBuscaCompartilhada,
        { token },
        { q: 'faturas' },
      );

      expect(foraDoEscopo).not.toContain(TITULOS_CENARIO.outrosEu);
      expect(foraDoEscopo).toContain('Nenhuma atividade encontrada.');
      expect(dentroDoEscopo).toContain(TITULOS_CENARIO.faturasFinanceiro);
      expect(dentroDoEscopo).not.toContain(TITULOS_CENARIO.faturasBugsEu);
      expect(dentroDoEscopo).toContain(
        `action="/compartilhado/${token}/busca"`,
      );
    });
  });

  describe('modalidade completa', () => {
    it('deve mostrar o board inteiro, inclusive sem tags, com edição mas sem administração', async () => {
      const token = criarLinkCompleto();

      const html = await renderizar(PaginaQuadroCompartilhado, { token });

      expect(html).toContain(TITULOS_CENARIO.semTagsFinanceiro);
      expect(html).toContain(TITULOS_CENARIO.outrosEu);
      expect(html).toContain(TEXTO_ALCA);
      expect(html).toContain(TEXTO_NOVA_ATIVIDADE);
      expect(html).not.toContain(
        `href="/compartilhado/${token}/atividades/nova"`,
      );
      expect(html).toContain(`href="/compartilhado/${token}/status"`);
      expect(html).not.toContain(TEXTO_COMPARTILHAR);
      expect(html).not.toContain('Integrações');
      expect(html).not.toContain('Sair');
    });

    it('deve editar no próprio detalhe, sem levar a outra página', async () => {
      const token = criarLinkCompleto();
      const id = String(cenario.faturasFinanceiro);

      const html = await renderizar(PaginaAtividadeCompartilhada, {
        token,
        id,
      });

      expect(html).toMatch(/<button[^>]*>Editar<\/button>/);
      expect(html).not.toContain(`/atividades/${id}/editar`);
    });

    it('deve enviar a credencial do link nos formulários de gestão', async () => {
      const token = criarLinkCompleto();

      const html = await renderizar(PaginaTagsCompartilhadas, { token });

      expect(html).toContain(`name="tokenCompartilhamento" value="${token}"`);
    });
  });

  describe('revogação e token inválido', () => {
    it('deve mandar para a página de indisponível depois da revogação, inclusive em rota interna', async () => {
      const link = criarLinkDeTeste(banco, {
        modalidade: 'completo',
        incluirArquivadas: true,
      });
      await renderizar(PaginaQuadroCompartilhado, { token: link.token });

      revogarLinkCompartilhamento(banco, { linkId: link.linkId });

      await expect(
        renderizar(PaginaQuadroCompartilhado, { token: link.token }),
      ).rejects.toThrow(INDISPONIVEL);
      await expect(
        renderizar(PaginaAtividadeCompartilhada, {
          token: link.token,
          id: String(cenario.faturasFinanceiro),
        }),
      ).rejects.toThrow(INDISPONIVEL);
    });

    it('deve tratar token forjado como indisponível', async () => {
      await expect(
        renderizar(PaginaQuadroCompartilhado, { token: 'b'.repeat(43) }),
      ).rejects.toThrow(INDISPONIVEL);
    });
  });

  describe('painel do administrador', () => {
    it('deve oferecer o modal de compartilhamento só ao administrador', async () => {
      simularCookie(criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token);

      const html = await renderizar(PaginaInicial, {});

      expect(html).toContain(TEXTO_COMPARTILHAR);
      expect(html).toContain('Integrações');
      expect(html).not.toContain('tokenCompartilhamento');
    });
  });

  describe('download de anexos', () => {
    beforeEach(() => {
      fs.writeFileSync(
        path.join(diretorioAnexos, ID_ARQUIVO_DENTRO),
        CONTEUDO_ANEXO,
      );
      fs.writeFileSync(
        path.join(diretorioAnexos, ID_ARQUIVO_FORA),
        CONTEUDO_ANEXO,
      );
    });

    it('deve baixar anexo do escopo como arquivo, nunca como página', async () => {
      const token = criarLinkRestrito();
      const anexoId = inserirAnexo(
        banco,
        cenario.faturasFinanceiro,
        ID_ARQUIVO_DENTRO,
        'relatório.pdf',
      );

      const resposta = await baixarAnexoCompartilhado(
        new Request('http://127.0.0.1/'),
        contextoRota({ token, id: String(anexoId) }),
      );

      expect(resposta.status).toBe(200);
      expect(await resposta.text()).toBe(CONTEUDO_ANEXO);
      expect(resposta.headers.get('content-type')).toBe(
        'application/octet-stream',
      );
      expect(resposta.headers.get('content-disposition')).toContain(
        "filename*=UTF-8''relat%C3%B3rio.pdf",
      );
    });

    it('deve responder 404 para anexo fora do escopo, inexistente ou com link revogado', async () => {
      const link = criarLinkDeTeste(banco, {
        tagIds: [exigirIdTag(banco, 'Faturas')],
        solicitanteIds: [exigirIdSolicitante(banco, 'Financeiro')],
      });
      const anexoFora = inserirAnexo(banco, cenario.outrosEu, ID_ARQUIVO_FORA);
      const anexoDentro = inserirAnexo(
        banco,
        cenario.faturasFinanceiro,
        ID_ARQUIVO_DENTRO,
      );
      const baixar = (id: string) =>
        baixarAnexoCompartilhado(
          new Request('http://127.0.0.1/'),
          contextoRota({ token: link.token, id }),
        );

      const fora = await baixar(String(anexoFora));
      const inexistente = await baixar('9999');
      revogarLinkCompartilhamento(banco, { linkId: link.linkId });
      const revogado = await baixar(String(anexoDentro));

      expect([fora.status, inexistente.status, revogado.status]).toEqual([
        404, 404, 404,
      ]);
      expect(await fora.text()).not.toContain(CONTEUDO_ANEXO);
    });

    it('deve exigir a sessão administrativa no download do painel', async () => {
      const anexoId = inserirAnexo(banco, cenario.outrosEu, ID_ARQUIVO_FORA);

      await expect(
        baixarAnexoAdministrador(
          new Request('http://127.0.0.1/'),
          contextoRota({ id: String(anexoId) }),
        ),
      ).rejects.toThrow('NEXT_REDIRECT:/entrar');

      simularCookie(criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token);
      const resposta = await baixarAnexoAdministrador(
        new Request('http://127.0.0.1/'),
        contextoRota({ id: String(anexoId) }),
      );
      expect(resposta.status).toBe(200);
    });
  });
});
