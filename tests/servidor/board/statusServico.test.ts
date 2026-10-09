import { eq } from 'drizzle-orm';
import {
  CODIGO_CONFLITO_ORDEM,
  CODIGO_CONFLITO_VERSAO,
} from '@/servidor/banco/concorrencia';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  escopoLinkStatus,
  linksCompartilhamento,
  statusBoard,
} from '@/servidor/banco/esquema';
import { listarIdsAtivosDoStatus } from '@/servidor/atividades/atividadesRepositorio';
import { arquivarAtividade } from '@/servidor/atividades/atividadesServico';
import { listarStatusDoBoard } from '@/servidor/board/boardRepositorio';
import { esquemaNovoStatus } from '@/servidor/board/esquemasStatus';
import {
  CODIGO_DESTINO_INVALIDO,
  CODIGO_DESTINO_OBRIGATORIO,
  CODIGO_NOME_STATUS_REPETIDO,
  CODIGO_STATUS_COMPARTILHADO,
  CODIGO_ULTIMO_STATUS,
  criarStatus,
  editarStatus,
  excluirStatus,
  reordenarStatus,
} from '@/servidor/board/statusServico';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  buscarAtividadeGravada,
  criarAtividadesNoStatus,
  exigirBoardId,
  exigirStatusPorChave,
  MOMENTO_LOCAL_TESTE,
} from '@/tests/suporte/fabricasAtividades';

const VERSAO_INICIAL = 1;
const QUANTIDADE_STATUS_INICIAIS = 4;
const HASH_FICTICIO = 'a'.repeat(64);

describe('statusServico', () => {
  let banco: BancoDados;
  let boardId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    boardId = exigirBoardId(banco);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function listarNomes(): string[] {
    return listarStatusDoBoard(banco, boardId).map((status) => status.nome);
  }

  function listarIds(): number[] {
    return listarStatusDoBoard(banco, boardId).map((status) => status.id);
  }

  describe('criarStatus', () => {
    it('deve criar o status no fim do board com chave derivada do nome', () => {
      const { statusId } = criarStatus(banco, {
        nome: 'Em revisão',
        finalizaAtividade: false,
      });

      const criado = listarStatusDoBoard(banco, boardId).at(-1);
      expect(criado?.id).toBe(statusId);
      expect(criado?.chave).toBe('em-revisao');
      expect(listarNomes()).toHaveLength(QUANTIDADE_STATUS_INICIAIS + 1);
    });

    it('deve recusar nome igual a outro status ignorando caixa e acento', () => {
      expect(() =>
        criarStatus(banco, { nome: 'concluidos', finalizaAtividade: true }),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_NOME_STATUS_REPETIDO }),
      );
      expect(listarNomes()).toHaveLength(QUANTIDADE_STATUS_INICIAIS);
    });

    it('deve gerar chave única quando a chave derivada já existe', () => {
      banco
        .update(statusBoard)
        .set({ nome: 'Fila' })
        .where(eq(statusBoard.chave, 'a-fazer'))
        .run();

      criarStatus(banco, { nome: 'A Fazer', finalizaAtividade: false });

      const chaves = listarStatusDoBoard(banco, boardId).map(
        (status) => status.chave,
      );
      expect(chaves).toContain('a-fazer-2');
    });
  });

  describe('editarStatus', () => {
    it('deve renomear, alterar a finalização e incrementar a versão', () => {
      const status = exigirStatusPorChave(banco, 'bloqueados');

      editarStatus(banco, {
        statusId: status.id,
        versaoEsperada: VERSAO_INICIAL,
        nome: 'Impedidos',
        finalizaAtividade: true,
      });

      const gravado = exigirStatusPorChave(banco, 'bloqueados');
      expect(gravado).toEqual(
        expect.objectContaining({
          nome: 'Impedidos',
          finalizaAtividade: true,
          versao: VERSAO_INICIAL + 1,
        }),
      );
    });

    it('deve permitir mudar só a caixa do próprio nome', () => {
      const status = exigirStatusPorChave(banco, 'a-fazer');

      editarStatus(banco, {
        statusId: status.id,
        versaoEsperada: VERSAO_INICIAL,
        nome: 'A FAZER',
        finalizaAtividade: false,
      });

      expect(exigirStatusPorChave(banco, 'a-fazer').nome).toBe('A FAZER');
    });

    it('deve recusar renomear sobre versão desatualizada', () => {
      const status = exigirStatusPorChave(banco, 'a-fazer');
      const alteracao = {
        statusId: status.id,
        versaoEsperada: VERSAO_INICIAL,
        nome: 'Backlog',
        finalizaAtividade: false,
      };
      editarStatus(banco, alteracao);

      expect(() =>
        editarStatus(banco, { ...alteracao, nome: 'Pendentes' }),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }));
      expect(exigirStatusPorChave(banco, 'a-fazer').nome).toBe('Backlog');
    });

    it('deve recusar nome já usado por outro status', () => {
      const status = exigirStatusPorChave(banco, 'a-fazer');

      expect(() =>
        editarStatus(banco, {
          statusId: status.id,
          versaoEsperada: VERSAO_INICIAL,
          nome: 'em andamento',
          finalizaAtividade: false,
        }),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_NOME_STATUS_REPETIDO }),
      );
    });
  });

  describe('reordenarStatus', () => {
    it('deve gravar a nova ordem das colunas', () => {
      const [aFazer = 0, emAndamento = 0, bloqueados = 0, concluidos = 0] =
        listarIds();
      const ordemNova = [bloqueados, aFazer, emAndamento, concluidos];

      reordenarStatus(banco, { statusId: bloqueados, ordemNova });

      expect(listarIds()).toEqual(ordemNova);
      expect(
        listarStatusDoBoard(banco, boardId).map((status) => status.posicao),
      ).toEqual([0, 1, 2, 3]);
    });

    it('deve recusar reordenação calculada sobre uma ordem desatualizada', () => {
      const [aFazer = 0, emAndamento = 0, bloqueados = 0, concluidos = 0] =
        listarIds();
      reordenarStatus(banco, {
        statusId: concluidos,
        ordemNova: [concluidos, aFazer, emAndamento, bloqueados],
      });
      const ordemGravada = listarIds();

      expect(() =>
        reordenarStatus(banco, {
          statusId: aFazer,
          ordemNova: [emAndamento, aFazer, bloqueados, concluidos],
        }),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_ORDEM }));
      expect(listarIds()).toEqual(ordemGravada);
    });

    it('deve recusar lista que não contém todos os status', () => {
      const [aFazer = 0, emAndamento = 0] = listarIds();

      expect(() =>
        reordenarStatus(banco, {
          statusId: aFazer,
          ordemNova: [emAndamento, aFazer],
        }),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_ORDEM }));
    });
  });

  describe('excluirStatus', () => {
    it('deve excluir status vazio sem pedir destino', () => {
      const bloqueados = exigirStatusPorChave(banco, 'bloqueados');

      const resultado = excluirStatus(
        banco,
        {
          statusId: bloqueados.id,
          versaoEsperada: VERSAO_INICIAL,
          statusDestinoId: null,
        },
        AGORA_TESTE,
      );

      expect(resultado.atividadesMovidas).toBe(0);
      expect(listarNomes()).not.toContain('Bloqueados');
    });

    it('deve exigir destino quando o status tem atividades, inclusive arquivadas', () => {
      const bloqueados = exigirStatusPorChave(banco, 'bloqueados');
      const [atividadeId = 0] = criarAtividadesNoStatus(banco, bloqueados.id, [
        'Arquivada',
      ]);
      arquivarAtividade(
        banco,
        { atividadeId, versaoEsperada: VERSAO_INICIAL },
        AGORA_TESTE,
      );

      expect(() =>
        excluirStatus(
          banco,
          {
            statusId: bloqueados.id,
            versaoEsperada: VERSAO_INICIAL,
            statusDestinoId: null,
          },
          AGORA_TESTE,
        ),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_DESTINO_OBRIGATORIO }),
      );
      expect(listarNomes()).toContain('Bloqueados');
    });

    it('deve mover ativas ao fim do destino e arquivadas sem apagar nenhuma atividade', () => {
      const bloqueados = exigirStatusPorChave(banco, 'bloqueados');
      const aFazer = exigirStatusPorChave(banco, 'a-fazer');
      const existentes = criarAtividadesNoStatus(banco, aFazer.id, ['Antiga']);
      const [ativaUm = 0, ativaDois = 0, arquivada = 0] =
        criarAtividadesNoStatus(banco, bloqueados.id, [
          'Bloqueada 1',
          'Bloqueada 2',
          'Bloqueada arquivada',
        ]);
      arquivarAtividade(
        banco,
        { atividadeId: arquivada, versaoEsperada: VERSAO_INICIAL },
        AGORA_TESTE,
      );
      const totalAntes = contarLinhas(banco, 'atividades');

      const resultado = excluirStatus(
        banco,
        {
          statusId: bloqueados.id,
          versaoEsperada: VERSAO_INICIAL,
          statusDestinoId: aFazer.id,
        },
        AGORA_TESTE,
      );

      expect(resultado.atividadesMovidas).toBe(3);
      expect(contarLinhas(banco, 'atividades')).toBe(totalAntes);
      expect(listarIdsAtivosDoStatus(banco, aFazer.id)).toEqual([
        ...existentes,
        ativaUm,
        ativaDois,
      ]);
      expect(buscarAtividadeGravada(banco, arquivada)).toEqual(
        expect.objectContaining({
          statusId: aFazer.id,
          arquivadaEm: AGORA_TESTE.toISOString(),
        }),
      );
      expect(listarNomes()).not.toContain('Bloqueados');
    });

    it('deve aplicar a regra de conclusão às atividades levadas a um status que finaliza', () => {
      const bloqueados = exigirStatusPorChave(banco, 'bloqueados');
      const concluidos = exigirStatusPorChave(banco, 'concluidos');
      const [atividadeId = 0] = criarAtividadesNoStatus(banco, bloqueados.id, [
        'Bloqueada',
      ]);

      excluirStatus(
        banco,
        {
          statusId: bloqueados.id,
          versaoEsperada: VERSAO_INICIAL,
          statusDestinoId: concluidos.id,
        },
        AGORA_TESTE,
      );

      expect(buscarAtividadeGravada(banco, atividadeId)).toEqual(
        expect.objectContaining({
          statusId: concluidos.id,
          concluidaEmData: MOMENTO_LOCAL_TESTE.data,
          versao: VERSAO_INICIAL + 1,
        }),
      );
    });

    it('deve recusar destino igual ao status excluído', () => {
      const bloqueados = exigirStatusPorChave(banco, 'bloqueados');
      criarAtividadesNoStatus(banco, bloqueados.id, ['Bloqueada']);

      expect(() =>
        excluirStatus(
          banco,
          {
            statusId: bloqueados.id,
            versaoEsperada: VERSAO_INICIAL,
            statusDestinoId: bloqueados.id,
          },
          AGORA_TESTE,
        ),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_DESTINO_INVALIDO }));
    });

    it('deve recusar excluir o último status do board', () => {
      const [primeiro = 0, ...demais] = listarIds();
      for (const statusId of demais) {
        excluirStatus(
          banco,
          { statusId, versaoEsperada: VERSAO_INICIAL, statusDestinoId: null },
          AGORA_TESTE,
        );
      }

      expect(() =>
        excluirStatus(
          banco,
          {
            statusId: primeiro,
            versaoEsperada: VERSAO_INICIAL,
            statusDestinoId: null,
          },
          AGORA_TESTE,
        ),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_ULTIMO_STATUS }));
    });

    it('deve recusar excluir com versão desatualizada', () => {
      const bloqueados = exigirStatusPorChave(banco, 'bloqueados');
      editarStatus(banco, {
        statusId: bloqueados.id,
        versaoEsperada: VERSAO_INICIAL,
        nome: 'Impedidos',
        finalizaAtividade: false,
      });

      expect(() =>
        excluirStatus(
          banco,
          {
            statusId: bloqueados.id,
            versaoEsperada: VERSAO_INICIAL,
            statusDestinoId: null,
          },
          AGORA_TESTE,
        ),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }));
    });

    it('deve recusar excluir status usado no escopo de um link de compartilhamento', () => {
      const bloqueados = exigirStatusPorChave(banco, 'bloqueados');
      const link = banco
        .insert(linksCompartilhamento)
        .values({ boardId, nome: 'Link', hashToken: HASH_FICTICIO })
        .returning({ id: linksCompartilhamento.id })
        .get();
      banco
        .insert(escopoLinkStatus)
        .values({ linkId: link.id, statusId: bloqueados.id })
        .run();

      expect(() =>
        excluirStatus(
          banco,
          {
            statusId: bloqueados.id,
            versaoEsperada: VERSAO_INICIAL,
            statusDestinoId: null,
          },
          AGORA_TESTE,
        ),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_STATUS_COMPARTILHADO }),
      );
    });
  });

  describe('cores da coluna', () => {
    function buscarCores(statusId: number) {
      return banco
        .select({
          corTitulo: statusBoard.corTitulo,
          corColuna: statusBoard.corColuna,
        })
        .from(statusBoard)
        .where(eq(statusBoard.id, statusId))
        .get();
    }

    it('deve criar o status com cores próprias e começar sem elas por padrão', () => {
      const { statusId } = criarStatus(banco, {
        nome: 'Urgentes',
        finalizaAtividade: false,
        corTitulo: '#b42318',
        corColuna: '#fde2e4',
      });
      const aFazer = exigirStatusPorChave(banco, 'a-fazer');

      expect(buscarCores(statusId)).toEqual({
        corTitulo: '#b42318',
        corColuna: '#fde2e4',
      });
      expect(buscarCores(aFazer.id)).toEqual({
        corTitulo: null,
        corColuna: null,
      });
    });

    it('deve trocar e limpar as cores ao editar', () => {
      const status = exigirStatusPorChave(banco, 'bloqueados');

      editarStatus(banco, {
        statusId: status.id,
        versaoEsperada: status.versao,
        nome: status.nome,
        finalizaAtividade: false,
        corTitulo: '#111111',
        corColuna: null,
      });

      expect(buscarCores(status.id)).toEqual({
        corTitulo: '#111111',
        corColuna: null,
      });
    });

    it('deve ler cor vazia do formulário como "usar padrão" e recusar cor inválida', () => {
      expect(
        esquemaNovoStatus.parse({
          nome: 'X',
          finalizaAtividade: '',
          corTitulo: '',
          corColuna: '#FFAA00',
        }),
      ).toEqual(
        expect.objectContaining({ corTitulo: null, corColuna: '#ffaa00' }),
      );
      expect(
        esquemaNovoStatus.safeParse({
          nome: 'X',
          finalizaAtividade: '',
          corTitulo: 'red',
          corColuna: '',
        }).success,
      ).toBe(false);
    });
  });
});
