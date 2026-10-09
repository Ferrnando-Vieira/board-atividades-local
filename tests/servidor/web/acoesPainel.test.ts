jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
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

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { SESSAO_ADMINISTRATIVA } from '@/config/constantesSeguranca';
import { criarSessao, revogarSessao } from '@/servidor/administracao/sessoes';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { administrador, ID_REGISTRO_UNICO } from '@/servidor/banco/esquema';
import { listarIdsAtivosDoStatus } from '@/servidor/atividades/atividadesRepositorio';
import { listarStatusDoBoard } from '@/servidor/board/boardRepositorio';
import {
  adicionarTagNoQuadro,
  arquivarAtividadeFormulario,
  criarAtividadeFormulario,
  criarAtividadeNoQuadro,
  desarquivarAtividadeFormulario,
  editarAtividadeFormulario,
  editarAtividadeNoDetalhe,
  moverAtividadeNoQuadro,
  removerTagNoQuadro,
} from '@/servidor/web/acoes/acoesAtividades';
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
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import {
  buscarAtividadeGravada,
  criarAtividadesNoStatus,
  exigirBoardId,
  exigirStatusPorChave,
} from '@/tests/suporte/fabricasAtividades';

type ArmazenamentoCookies = Awaited<ReturnType<typeof cookies>>;

const REDIRECIONA_PARA_ENTRADA = 'NEXT_REDIRECT:/entrar';
const REDIRECIONA_PARA_CONFIGURACAO = 'NEXT_REDIRECT:/configuracao-inicial';
const TOKEN_FORJADO = 'token-que-nunca-foi-emitido';
const TABELAS_OBSERVADAS = [
  'atividades',
  'atividades_tags',
  'tags',
  'solicitantes',
  'status_board',
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

function montarFormulario(campos: Record<string, string | string[]>) {
  const formulario = new FormData();
  for (const [campo, valor] of Object.entries(campos)) {
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      formulario.append(campo, item);
    }
  }
  return formulario;
}

function cadastrarAdministrador(banco: BancoDados): void {
  banco
    .insert(administrador)
    .values({
      id: ID_REGISTRO_UNICO,
      usuario: 'proprietario',
      hashSenha: 'scrypt$hash-de-teste',
      senhaAlteradaEm: new Date().toISOString(),
    })
    .run();
}

function fotografarContagens(banco: BancoDados): number[] {
  return TABELAS_OBSERVADAS.map((tabela) => contarLinhas(banco, tabela));
}

describe('ações do painel', () => {
  let banco: BancoDados;
  let aFazerId: number;
  let emAndamentoId: number;
  let atividadeId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    emAndamentoId = exigirStatusPorChave(banco, 'em-andamento').id;
    [atividadeId = 0] = criarAtividadesNoStatus(banco, aFazerId, ['Base']);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function formularioAtividade(titulo: string) {
    return montarFormulario({
      titulo,
      statusId: String(aFazerId),
      prioridade: '3',
      solicitante: 'Financeiro',
      tags: ['Faturas', 'faturas'],
    });
  }

  const tentativasSemPermissao: [string, () => Promise<unknown>][] = [
    [
      'criarAtividadeFormulario',
      () =>
        criarAtividadeFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          formularioAtividade('Invasora'),
        ),
    ],
    [
      'editarAtividadeFormulario',
      () => {
        const formulario = formularioAtividade('Alterada');
        formulario.append('atividadeId', String(atividadeId));
        formulario.append('versaoEsperada', '1');
        return editarAtividadeFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          formulario,
        );
      },
    ],
    [
      'editarAtividadeNoDetalhe',
      () => {
        const formulario = formularioAtividade('Alterada no detalhe');
        formulario.append('atividadeId', String(atividadeId));
        formulario.append('versaoEsperada', '1');
        return editarAtividadeNoDetalhe(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          formulario,
        );
      },
    ],
    [
      'moverAtividadeNoQuadro',
      () =>
        moverAtividadeNoQuadro({
          atividadeId,
          versaoEsperada: 1,
          statusDestinoId: emAndamentoId,
          posicao: null,
        }),
    ],
    [
      'criarAtividadeNoQuadro',
      () =>
        criarAtividadeNoQuadro(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          formularioAtividade('Invasora'),
        ),
    ],
    [
      'adicionarTagNoQuadro',
      () => adicionarTagNoQuadro({ atividadeId, nome: 'Invasora' }),
    ],
    ['removerTagNoQuadro', () => removerTagNoQuadro({ atividadeId, tagId: 1 })],
    [
      'arquivarAtividadeFormulario',
      () =>
        arquivarAtividadeFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({
            atividadeId: String(atividadeId),
            versaoEsperada: '1',
          }),
        ),
    ],
    [
      'desarquivarAtividadeFormulario',
      () =>
        desarquivarAtividadeFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({
            atividadeId: String(atividadeId),
            versaoEsperada: '1',
          }),
        ),
    ],
    [
      'criarStatusFormulario',
      () =>
        criarStatusFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({ nome: 'Invasor' }),
        ),
    ],
    [
      'editarStatusFormulario',
      () =>
        editarStatusFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({
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
          montarFormulario({
            statusId: String(emAndamentoId),
            versaoEsperada: '1',
          }),
        ),
    ],
    [
      'reordenarStatusNoQuadro',
      () =>
        reordenarStatusNoQuadro({
          statusId: emAndamentoId,
          ordemNova: [
            emAndamentoId,
            ...listarStatusDoBoard(banco, exigirBoardId(banco))
              .map((status) => status.id)
              .filter((id) => id !== emAndamentoId),
          ],
        }),
    ],
    [
      'criarTagFormulario',
      () =>
        criarTagFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({ nome: 'Invasora' }),
        ),
    ],
    [
      'editarTagFormulario',
      () =>
        editarTagFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({ tagId: '1', nomeAtual: 'X', nome: 'Y' }),
        ),
    ],
    [
      'excluirTagFormulario',
      () =>
        excluirTagFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          montarFormulario({ tagId: '1', nomeAtual: 'X' }),
        ),
    ],
  ];

  describe('autorização no servidor', () => {
    beforeEach(() => {
      cadastrarAdministrador(banco);
    });

    it.each(tentativasSemPermissao)(
      '%s deve redirecionar para a entrada sem cookie e não gravar nada',
      async (_nome, invocar) => {
        simularCookie(undefined);
        const antes = fotografarContagens(banco);

        await expect(invocar()).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);

        expect(fotografarContagens(banco)).toEqual(antes);
        expect(buscarAtividadeGravada(banco, atividadeId).versao).toBe(1);
        expect(revalidatePath).not.toHaveBeenCalled();
      },
    );

    it.each(tentativasSemPermissao)(
      '%s deve recusar cookie forjado',
      async (_nome, invocar) => {
        simularCookie(TOKEN_FORJADO);
        const antes = fotografarContagens(banco);

        await expect(invocar()).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);

        expect(fotografarContagens(banco)).toEqual(antes);
      },
    );

    it('deve recusar a sessão depois de revogada (saída)', async () => {
      const { token } = criarSessao(banco, ID_REGISTRO_UNICO, new Date());
      revogarSessao(banco, token);
      simularCookie(token);

      await expect(
        criarAtividadeFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          formularioAtividade('Depois de sair'),
        ),
      ).rejects.toThrow(REDIRECIONA_PARA_ENTRADA);

      expect(contarLinhas(banco, 'atividades')).toBe(1);
    });
  });

  describe('instalação incompleta', () => {
    it('deve mandar para a configuração inicial quando não há administrador', async () => {
      simularCookie(TOKEN_FORJADO);

      await expect(
        moverAtividadeNoQuadro({
          atividadeId,
          versaoEsperada: 1,
          statusDestinoId: emAndamentoId,
          ordemDestino: [atividadeId],
        }),
      ).rejects.toThrow(REDIRECIONA_PARA_CONFIGURACAO);

      expect(buscarAtividadeGravada(banco, atividadeId).statusId).toBe(
        aFazerId,
      );
    });
  });

  describe('com sessão válida', () => {
    beforeEach(() => {
      cadastrarAdministrador(banco);
      simularCookie(criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token);
    });

    it('deve criar a atividade, revalidar e voltar ao quadro com aviso', async () => {
      await expect(
        criarAtividadeFormulario(
          ESTADO_FORMULARIO_GESTAO_INICIAL,
          formularioAtividade('Criada pela ação'),
        ),
      ).rejects.toThrow('NEXT_REDIRECT:/?aviso=atividade-criada');

      expect(contarLinhas(banco, 'atividades')).toBe(2);
      expect(contarLinhas(banco, 'tags')).toBe(1);
      expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    });

    it('deve devolver erros por campo e os valores enviados quando a validação falha', async () => {
      const resultado = await criarAtividadeFormulario(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        montarFormulario({
          titulo: ' ',
          statusId: String(aFazerId),
          prioridade: '12',
        }),
      );

      expect(resultado.errosCampos).toEqual(
        expect.objectContaining({
          titulo: expect.any(Array),
          prioridade: expect.any(Array),
        }),
      );
      expect(resultado.valores).toEqual(
        expect.objectContaining({ prioridade: '12' }),
      );
      expect(resultado.tentativa).toBe(1);
      expect(contarLinhas(banco, 'atividades')).toBe(1);
    });

    it('deve devolver o conflito de versão sem sobrescrever a edição alheia', async () => {
      const formulario = formularioAtividade('Edição atrasada');
      formulario.append('atividadeId', String(atividadeId));
      formulario.append('versaoEsperada', '7');

      const resultado = await editarAtividadeFormulario(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        formulario,
      );

      expect(resultado.mensagemErro).toContain('alterada por outra operação');
      expect(buscarAtividadeGravada(banco, atividadeId).titulo).toBe('Base');
    });

    it('deve editar no próprio detalhe sem redirecionar e revalidar', async () => {
      const formulario = formularioAtividade('Editada no modal');
      formulario.append('atividadeId', String(atividadeId));
      formulario.append('versaoEsperada', '1');
      formulario.append('prazoData', '');
      formulario.append('prazoHora', '');

      const estado = await editarAtividadeNoDetalhe(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        formulario,
      );

      expect(estado.mensagemSucesso).toBe('Alterações salvas.');
      expect(estado.errosCampos).toBeUndefined();
      const gravada = buscarAtividadeGravada(banco, atividadeId);
      expect(gravada.titulo).toBe('Editada no modal');
      expect(gravada.prazoData).toBeNull();
      expect(gravada.versao).toBe(2);
      expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    });

    it('deve devolver ao detalhe o conflito de versão sem gravar', async () => {
      const formulario = formularioAtividade('Edição atrasada no modal');
      formulario.append('atividadeId', String(atividadeId));
      formulario.append('versaoEsperada', '7');

      const estado = await editarAtividadeNoDetalhe(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        formulario,
      );

      expect(estado.mensagemSucesso).toBeUndefined();
      expect(estado.mensagemErro).toContain('alterada por outra operação');
      expect(buscarAtividadeGravada(banco, atividadeId).titulo).toBe('Base');
    });

    it('deve criar pelo modal sem redirecionar e revalidar o quadro', async () => {
      const antes = contarLinhas(banco, 'atividades');

      const estado = await criarAtividadeNoQuadro(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        formularioAtividade('Criada no modal'),
      );

      expect(estado.mensagemSucesso).toEqual(expect.any(String));
      expect(estado.errosCampos).toBeUndefined();
      expect(contarLinhas(banco, 'atividades')).toBe(antes + 1);
      expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    });

    it('deve devolver ao modal o erro de cada campo sem gravar', async () => {
      const antes = fotografarContagens(banco);

      const estado = await criarAtividadeNoQuadro(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        montarFormulario({ titulo: '   ', statusId: String(aFazerId) }),
      );

      expect(estado.errosCampos?.titulo).toEqual([expect.any(String)]);
      expect(estado.valores).toEqual(
        expect.objectContaining({ statusId: String(aFazerId) }),
      );
      expect(fotografarContagens(banco)).toEqual(antes);
    });

    it('deve adicionar e remover tag pelo cartão', async () => {
      const adicionada = await adicionarTagNoQuadro({
        atividadeId,
        nome: 'Rápida',
      });
      const [tagId = 0] = banco.$client
        .prepare("SELECT id FROM tags WHERE nome = 'Rápida'")
        .pluck()
        .all() as number[];
      const removida = await removerTagNoQuadro({ atividadeId, tagId });

      expect(adicionada).toEqual({ ok: true });
      expect(removida).toEqual({ ok: true });
      expect(buscarAtividadeGravada(banco, atividadeId).versao).toBe(3);
      expect(contarLinhas(banco, 'atividades_tags')).toBe(0);
    });

    it('deve recusar nome de tag vazio com mensagem do campo', async () => {
      const resultado = await adicionarTagNoQuadro({ atividadeId, nome: ' ' });

      expect(resultado).toEqual(
        expect.objectContaining({ ok: false, codigo: 'dados-invalidos' }),
      );
      expect(contarLinhas(banco, 'tags')).toBe(0);
    });

    it('deve mover pelo quadro e recusar carga malformada sem gravar', async () => {
      const malformado = await moverAtividadeNoQuadro({
        atividadeId,
        versaoEsperada: 1,
        statusDestinoId: emAndamentoId,
        ordemDestino: [atividadeId],
      });
      const movido = await moverAtividadeNoQuadro({
        atividadeId,
        versaoEsperada: 1,
        statusDestinoId: emAndamentoId,
        posicao: null,
      });

      expect(malformado).toEqual(
        expect.objectContaining({ ok: false, codigo: 'dados-invalidos' }),
      );
      expect(movido).toEqual({ ok: true });
      expect(listarIdsAtivosDoStatus(banco, emAndamentoId)).toEqual([
        atividadeId,
      ]);
    });

    it('deve devolver o conflito de versão do quadro como resultado e revalidar', async () => {
      const [outraId = 0] = criarAtividadesNoStatus(banco, aFazerId, ['Outra']);

      const resultado = await moverAtividadeNoQuadro({
        atividadeId: outraId,
        versaoEsperada: 7,
        statusDestinoId: emAndamentoId,
        posicao: null,
      });

      expect(resultado).toEqual(
        expect.objectContaining({ ok: false, codigo: 'conflito-de-versao' }),
      );
      expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
      expect(listarIdsAtivosDoStatus(banco, emAndamentoId)).toEqual([]);
    });

    it('deve criar status com sucesso e informar duplicidade sem gravar', async () => {
      const criado = await criarStatusFormulario(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        montarFormulario({ nome: 'Em revisão', finalizaAtividade: 'sim' }),
      );
      const repetido = await criarStatusFormulario(
        criado,
        montarFormulario({ nome: 'em revisao' }),
      );

      expect(criado.mensagemSucesso).toBeDefined();
      expect(repetido.mensagemErro).toBeDefined();
      expect(repetido.tentativa).toBe(2);
      const novo = listarStatusDoBoard(banco, exigirBoardId(banco)).at(-1);
      expect(novo).toEqual(
        expect.objectContaining({
          nome: 'Em revisão',
          finalizaAtividade: true,
        }),
      );
    });

    it('deve exigir destino para excluir status com atividades', async () => {
      const resultado = await excluirStatusFormulario(
        ESTADO_FORMULARIO_GESTAO_INICIAL,
        montarFormulario({ statusId: String(aFazerId), versaoEsperada: '1' }),
      );

      expect(resultado.mensagemErro).toContain('Escolha o status');
      expect(contarLinhas(banco, 'status_board')).toBe(4);
      expect(contarLinhas(banco, 'atividades')).toBe(1);
    });
  });
});
