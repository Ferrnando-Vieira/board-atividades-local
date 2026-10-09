jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/server', () => ({
  connection: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/servidor/web/bancoAplicacao', () => ({
  CODIGO_BANCO_AUSENTE: 'banco-ausente',
  obterBancoAplicacao: jest.fn(),
}));

const URL_BASE_LAN_TESTE = 'http://192.168.0.50:3000';
process.env.URL_BASE_LAN = URL_BASE_LAN_TESTE;

import { cookies } from 'next/headers';
import { SESSAO_ADMINISTRATIVA } from '@/config/constantesSeguranca';
import { criarSessao } from '@/servidor/administracao/sessoes';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { ID_REGISTRO_UNICO } from '@/servidor/banco/esquema';
import { listarIdsAtivosDoStatus } from '@/servidor/atividades/atividadesRepositorio';
import { listarStatusDoBoard } from '@/servidor/board/boardRepositorio';
import { validarTokenCompartilhamento } from '@/servidor/compartilhamento/acessoCompartilhamento';
import { garantirLinkPadrao } from '@/servidor/compartilhamento/linkPadrao';
import { revogarLinkCompartilhamento } from '@/servidor/compartilhamento/linksServico';
import { calcularHashToken } from '@/servidor/seguranca/tokens';
import { validarTokenApi } from '@/servidor/tokensApi/tokensApiServico';
import {
  adicionarTagNoQuadro,
  arquivarAtividadeFormulario,
  criarAtividadeFormulario,
  criarAtividadeNoQuadro,
  desarquivarAtividadeFormulario,
  editarAtividadeFormulario,
  moverAtividadeNoQuadro,
  removerTagNoQuadro,
} from '@/servidor/web/acoes/acoesAtividades';
import {
  criarLinkCompartilhamentoFormulario,
  revogarLinkCompartilhamentoFormulario,
} from '@/servidor/web/acoes/acoesCompartilhamento';
import {
  criarStatusFormulario,
  editarStatusFormulario,
  excluirStatusFormulario,
  reordenarStatusNoQuadro,
} from '@/servidor/web/acoes/acoesStatus';
import {
  criarTagFormulario,
  excluirTagFormulario,
  editarTagFormulario,
} from '@/servidor/web/acoes/acoesTags';
import {
  criarTokenApiFormulario,
  revogarTokenApiFormulario,
} from '@/servidor/web/acoes/acoesTokensApi';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  ESTADO_CRIACAO_CREDENCIAL_INICIAL,
  ESTADO_FORMULARIO_GESTAO_INICIAL,
} from '@/types/formulario';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import {
  buscarAtividadeGravada,
  exigirBoardId,
  exigirStatusPorChave,
} from '@/tests/suporte/fabricasAtividades';
import {
  cadastrarAdministrador,
  criarCenarioEscopo,
  criarLinkDeTeste,
  exigirIdSolicitante,
  exigirIdTag,
  type CenarioEscopo,
} from '@/tests/suporte/fabricasCompartilhamento';

type ArmazenamentoCookies = Awaited<ReturnType<typeof cookies>>;

const CAMPO_CREDENCIAL = 'tokenCompartilhamento';
const CHAVE_LINK_PADRAO_TESTE = Buffer.alloc(32, 7);
const REDIRECIONA_PARA_INDISPONIVEL = 'NEXT_REDIRECT:/compartilhado';
const REDIRECIONA_PARA_ENTRADA = 'NEXT_REDIRECT:/entrar';
const TABELAS_OBSERVADAS = [
  'atividades',
  'atividades_tags',
  'tags',
  'solicitantes',
  'status_board',
  'links_compartilhamento',
  'escopo_link_tags',
  'tokens_api',
];

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

function montarFormulario(campos: Record<string, string | string[] | Blob>) {
  const formulario = new FormData();
  for (const [campo, valor] of Object.entries(campos)) {
    if (valor instanceof Blob) {
      formulario.append(campo, valor);
      continue;
    }
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      formulario.append(campo, item);
    }
  }
  return formulario;
}

describe('ações com link de compartilhamento', () => {
  let banco: BancoDados;
  let cenario: CenarioEscopo;
  let aFazerId: number;
  let emAndamentoId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    cenario = criarCenarioEscopo(banco);
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    emAndamentoId = exigirStatusPorChave(banco, 'em-andamento').id;
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
    simularCookie(undefined);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function fotografar(): number[] {
    return TABELAS_OBSERVADAS.map((tabela) => contarLinhas(banco, tabela));
  }

  function montarTentativas(credencial: string | Blob) {
    const comCredencial = (campos: Record<string, string | string[]>) =>
      montarFormulario({ ...campos, [CAMPO_CREDENCIAL]: credencial });
    const textoCredencial = typeof credencial === 'string' ? credencial : '';
    const tentativas: [string, () => Promise<unknown>][] = [
      [
        'criarAtividadeFormulario',
        () =>
          criarAtividadeFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({ titulo: 'Invasora', statusId: String(aFazerId) }),
          ),
      ],
      [
        'editarAtividadeFormulario',
        () =>
          editarAtividadeFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({
              atividadeId: String(cenario.faturasFinanceiro),
              versaoEsperada: '1',
              titulo: 'Alterada',
              statusId: String(aFazerId),
            }),
          ),
      ],
      [
        'moverAtividadeNoQuadro',
        () =>
          moverAtividadeNoQuadro(
            {
              atividadeId: cenario.faturasFinanceiro,
              versaoEsperada: 1,
              statusDestinoId: emAndamentoId,
              posicao: null,
            },
            textoCredencial,
          ),
      ],
      [
        'criarAtividadeNoQuadro',
        () =>
          criarAtividadeNoQuadro(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({ titulo: 'Invasora', statusId: String(aFazerId) }),
          ),
      ],
      [
        'adicionarTagNoQuadro',
        () =>
          adicionarTagNoQuadro(
            { atividadeId: cenario.faturasFinanceiro, nome: 'Invasora' },
            textoCredencial,
          ),
      ],
      [
        'removerTagNoQuadro',
        () =>
          removerTagNoQuadro(
            {
              atividadeId: cenario.faturasFinanceiro,
              tagId: exigirIdTag(banco, 'Faturas'),
            },
            textoCredencial,
          ),
      ],
      [
        'arquivarAtividadeFormulario',
        () =>
          arquivarAtividadeFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({
              atividadeId: String(cenario.faturasFinanceiro),
              versaoEsperada: '1',
            }),
          ),
      ],
      [
        'desarquivarAtividadeFormulario',
        () =>
          desarquivarAtividadeFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({
              atividadeId: String(cenario.arquivadaFaturasFinanceiro),
              versaoEsperada: '2',
            }),
          ),
      ],
      [
        'criarStatusFormulario',
        () =>
          criarStatusFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({ nome: 'Invasor' }),
          ),
      ],
      [
        'editarStatusFormulario',
        () =>
          editarStatusFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({
              statusId: String(aFazerId),
              versaoEsperada: '1',
              nome: 'Renomeado',
            }),
          ),
      ],
      [
        'excluirStatusFormulario',
        () =>
          excluirStatusFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({
              statusId: String(emAndamentoId),
              versaoEsperada: '1',
            }),
          ),
      ],
      [
        'reordenarStatusNoQuadro',
        () =>
          reordenarStatusNoQuadro(
            {
              statusId: emAndamentoId,
              ordemNova: [
                emAndamentoId,
                ...listarStatusDoBoard(banco, exigirBoardId(banco))
                  .map((status) => status.id)
                  .filter((id) => id !== emAndamentoId),
              ],
            },
            textoCredencial,
          ),
      ],
      [
        'criarTagFormulario',
        () =>
          criarTagFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({ nome: 'Invasora' }),
          ),
      ],
      [
        'editarTagFormulario',
        () =>
          editarTagFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({
              tagId: String(exigirIdTag(banco, 'Bugs')),
              nomeAtual: 'Bugs',
              nome: 'Defeitos',
            }),
          ),
      ],
      [
        'excluirTagFormulario',
        () =>
          excluirTagFormulario(
            ESTADO_FORMULARIO_GESTAO_INICIAL,
            comCredencial({
              tagId: String(exigirIdTag(banco, 'Bugs')),
              nomeAtual: 'Bugs',
            }),
          ),
      ],
    ];
    return tentativas;
  }

  const NOMES_ACOES = [
    'criarAtividadeFormulario',
    'editarAtividadeFormulario',
    'moverAtividadeNoQuadro',
    'criarAtividadeNoQuadro',
    'adicionarTagNoQuadro',
    'removerTagNoQuadro',
    'arquivarAtividadeFormulario',
    'desarquivarAtividadeFormulario',
    'criarStatusFormulario',
    'editarStatusFormulario',
    'excluirStatusFormulario',
    'reordenarStatusNoQuadro',
    'criarTagFormulario',
    'editarTagFormulario',
    'excluirTagFormulario',
  ];

  function exigirTentativa(credencial: string | Blob, nome: string) {
    const tentativa = montarTentativas(credencial).find(
      ([nomeAcao]) => nomeAcao === nome,
    );
    if (!tentativa) {
      throw new Error(`Ação ${nome} ausente.`);
    }
    return tentativa[1];
  }

  describe('link restrito', () => {
    it.each(NOMES_ACOES)(
      '%s deve voltar ao quadro somente leitura sem gravar nada',
      async (nome) => {
        const { token } = criarLinkDeTeste(banco, {
          tagIds: [exigirIdTag(banco, 'Faturas')],
        });
        const antes = fotografar();

        await expect(exigirTentativa(token, nome)()).rejects.toThrow(
          `NEXT_REDIRECT:/compartilhado/${token}`,
        );

        expect(fotografar()).toEqual(antes);
        expect(
          buscarAtividadeGravada(banco, cenario.faturasFinanceiro),
        ).toEqual(expect.objectContaining({ versao: 1, statusId: aFazerId }));
      },
    );
  });

  describe('link padrão de visualização', () => {
    it.each(NOMES_ACOES)(
      '%s deve voltar ao quadro somente leitura sem gravar nada',
      async (nome) => {
        const { token } = garantirLinkPadrao(banco, CHAVE_LINK_PADRAO_TESTE);
        const antes = fotografar();

        await expect(exigirTentativa(token, nome)()).rejects.toThrow(
          `NEXT_REDIRECT:/compartilhado/${token}`,
        );

        expect(fotografar()).toEqual(antes);
      },
    );
  });

  describe('credencial inválida', () => {
    it.each(NOMES_ACOES)(
      '%s deve recusar link revogado sem gravar nada',
      async (nome) => {
        const link = criarLinkDeTeste(banco, {
          modalidade: 'completo',
          incluirArquivadas: true,
        });
        revogarLinkCompartilhamento(banco, { linkId: link.linkId });
        const antes = fotografar();

        await expect(exigirTentativa(link.token, nome)()).rejects.toThrow(
          REDIRECIONA_PARA_INDISPONIVEL,
        );

        expect(fotografar()).toEqual(antes);
      },
    );

    it('deve recusar token forjado mesmo com sessão administrativa ativa', async () => {
      simularCookie(criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token);
      const antes = fotografar();

      await expect(
        exigirTentativa('a'.repeat(43), 'criarAtividadeFormulario')(),
      ).rejects.toThrow(REDIRECIONA_PARA_INDISPONIVEL);

      expect(fotografar()).toEqual(antes);
    });

    it('deve recusar credencial que não é texto', async () => {
      const antes = fotografar();

      await expect(
        exigirTentativa(new Blob(['x']), 'criarTagFormulario')(),
      ).rejects.toThrow(REDIRECIONA_PARA_INDISPONIVEL);

      expect(fotografar()).toEqual(antes);
    });
  });

  describe('link completo', () => {
    let token: string;
    let prefixo: string;

    beforeEach(() => {
      token = criarLinkDeTeste(banco, {
        modalidade: 'completo',
        incluirArquivadas: true,
      }).token;
      prefixo = `/compartilhado/${token}`;
    });

    it('deve criar atividade e voltar ao quadro do link', async () => {
      await expect(
        exigirTentativa(token, 'criarAtividadeFormulario')(),
      ).rejects.toThrow(`NEXT_REDIRECT:${prefixo}?aviso=atividade-criada`);

      expect(contarLinhas(banco, 'atividades')).toBe(7);
    });

    it('deve editar e voltar ao detalhe dentro do link', async () => {
      await expect(
        exigirTentativa(token, 'editarAtividadeFormulario')(),
      ).rejects.toThrow(
        `NEXT_REDIRECT:${prefixo}/atividades/${cenario.faturasFinanceiro}?aviso=atividade-salva`,
      );

      expect(
        buscarAtividadeGravada(banco, cenario.faturasFinanceiro).titulo,
      ).toBe('Alterada');
    });

    it('deve mover pelo quadro e reordenar colunas', async () => {
      const movimento = await exigirTentativa(
        token,
        'moverAtividadeNoQuadro',
      )();
      const reordenacao = await exigirTentativa(
        token,
        'reordenarStatusNoQuadro',
      )();

      expect(movimento).toEqual({ ok: true });
      expect(reordenacao).toEqual({ ok: true });
      expect(listarIdsAtivosDoStatus(banco, emAndamentoId)).toEqual([
        cenario.faturasFinanceiro,
      ]);
    });

    it('deve criar status e renomear tag', async () => {
      const status = await exigirTentativa(token, 'criarStatusFormulario')();
      const tag = await exigirTentativa(token, 'editarTagFormulario')();

      expect(status).toEqual(
        expect.objectContaining({ mensagemSucesso: expect.any(String) }),
      );
      expect(tag).toEqual(
        expect.objectContaining({ mensagemSucesso: expect.any(String) }),
      );
      expect(contarLinhas(banco, 'status_board')).toBe(5);
    });

    it('deve excluir tag e voltar à tela de tags do link', async () => {
      await expect(
        exigirTentativa(token, 'excluirTagFormulario')(),
      ).rejects.toThrow(`NEXT_REDIRECT:${prefixo}/tags?aviso=tag-excluida`);

      expect(contarLinhas(banco, 'tags')).toBe(2);
    });

    it('deve arquivar e restaurar dentro do link', async () => {
      await expect(
        exigirTentativa(token, 'arquivarAtividadeFormulario')(),
      ).rejects.toThrow(`NEXT_REDIRECT:${prefixo}?aviso=atividade-arquivada`);
      await expect(
        desarquivarAtividadeFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({
            atividadeId: String(cenario.arquivadaFaturasFinanceiro),
            versaoEsperada: '2',
            retorno: 'arquivadas',
            [CAMPO_CREDENCIAL]: token,
          }),
        ),
      ).rejects.toThrow(
        `NEXT_REDIRECT:${prefixo}/arquivadas?aviso=atividade-restaurada`,
      );
    });

    it('não deve administrar links nem tokens de API sem a sessão administrativa', async () => {
      const antes = fotografar();
      const credencial = { [CAMPO_CREDENCIAL]: token };

      const tentativas = [
        criarLinkCompartilhamentoFormulario(
          ESTADO_CRIACAO_CREDENCIAL_INICIAL,
          montarFormulario({
            ...credencial,
            nome: 'Escalada',
            modalidade: 'completo',
          }),
        ),
        revogarLinkCompartilhamentoFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({ ...credencial, linkId: '1' }),
        ),
        criarTokenApiFormulario(
          ESTADO_CRIACAO_CREDENCIAL_INICIAL,
          montarFormulario({
            ...credencial,
            nome: 'Escalada',
            permissoes: 'board:escrever',
          }),
        ),
        revogarTokenApiFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({ ...credencial, tokenId: '1' }),
        ),
      ];

      for (const tentativa of tentativas) {
        await expect(tentativa).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);
      }
      expect(fotografar()).toEqual(antes);
      expect(validarTokenCompartilhamento(banco, token)).not.toBeNull();
    });
  });

  describe('administração pelo proprietário', () => {
    beforeEach(() => {
      simularCookie(criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token);
    });

    it('deve gerar o link com a URL base da LAN e guardar só o hash', async () => {
      const estado = await criarLinkCompartilhamentoFormulario(
        ESTADO_CRIACAO_CREDENCIAL_INICIAL,
        montarFormulario({
          nome: 'Financeiro',
          modalidade: 'restrito',
          tagIds: String(exigirIdTag(banco, 'Faturas')),
          solicitanteIds: String(exigirIdSolicitante(banco, 'Financeiro')),
          validadeDias: '30',
        }),
      );

      const url = estado.credencialGerada ?? '';
      const token = url.split('/').at(-1) ?? '';
      const gravado = banco.$client
        .prepare('SELECT hash_token FROM links_compartilhamento')
        .get() as { hash_token: string };
      expect(url).toBe(`${URL_BASE_LAN_TESTE}/compartilhado/${token}`);
      expect(gravado.hash_token).toBe(calcularHashToken(token));
      expect(validarTokenCompartilhamento(banco, token)?.restricao).toEqual(
        expect.objectContaining({ arquivamento: 'ativas' }),
      );
    });

    it('deve recusar link restrito sem tag e sem solicitante', async () => {
      const estado = await criarLinkCompartilhamentoFormulario(
        ESTADO_CRIACAO_CREDENCIAL_INICIAL,
        montarFormulario({ nome: 'Vazio', modalidade: 'restrito' }),
      );

      expect(estado.mensagemErro).toBe(
        'No link restrito, escolha ao menos uma tag ou um solicitante.',
      );
      expect(estado.credencialGerada).toBeUndefined();
      expect(contarLinhas(banco, 'links_compartilhamento')).toBe(0);
    });

    it('deve revogar o link e cortar o acesso imediatamente', async () => {
      const link = criarLinkDeTeste(banco, { modalidade: 'completo' });

      const estado = await revogarLinkCompartilhamentoFormulario(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        montarFormulario({ linkId: String(link.linkId) }),
      );

      expect(estado.mensagemSucesso).toBeDefined();
      expect(validarTokenCompartilhamento(banco, link.token)).toBeNull();
    });

    it('deve emitir e revogar token de API', async () => {
      const emitido = await criarTokenApiFormulario(
        ESTADO_CRIACAO_CREDENCIAL_INICIAL,
        montarFormulario({
          nome: 'Claude Code',
          permissoes: ['atividades:ler', 'atividades:escrever'],
        }),
      );
      const token = emitido.credencialGerada ?? '';
      const validado = validarTokenApi(banco, token);

      await revogarTokenApiFormulario(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        montarFormulario({ tokenId: String(validado?.tokenId) }),
      );

      expect(validado?.permissoes).toEqual([
        'atividades:ler',
        'atividades:escrever',
      ]);
      expect(validarTokenApi(banco, token)).toBeNull();
    });

    it('deve recusar token de API sem permissão escolhida', async () => {
      const estado = await criarTokenApiFormulario(
        ESTADO_CRIACAO_CREDENCIAL_INICIAL,
        montarFormulario({ nome: 'Sem permissão' }),
      );

      expect(estado.errosCampos?.permissoes).toEqual([
        'Escolha ao menos uma permissão.',
      ]);
      expect(contarLinhas(banco, 'tokens_api')).toBe(0);
    });
  });
});
