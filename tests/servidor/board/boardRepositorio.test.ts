import { eq } from 'drizzle-orm';
import { FUSO_HORARIO_PADRAO } from '@/config/constantes';
import { CODIGO_CONFLITO_VERSAO } from '@/servidor/banco/concorrencia';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { boards, statusBoard } from '@/servidor/banco/esquema';
import {
  atualizarConfiguracaoBoard,
  buscarBoardPadrao,
  garantirBoardPadrao,
  listarStatusDoBoard,
} from '@/servidor/board/boardRepositorio';
import { contarLinhas, criarBancoMigrado } from '@/tests/suporte/bancoTeste';

const NOMES_STATUS_ESPERADOS = [
  'A Fazer',
  'Em Andamento',
  'Bloqueados',
  'Concluídos',
];
const QUANTIDADE_STATUS_INICIAIS = 4;
const NOVO_NOME_BOARD = 'Atividades da equipe';
const VERSAO_INICIAL = 1;
const FUSO_INEXISTENTE = 'America/Cidade_Inexistente';

describe('boardRepositorio', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoMigrado();
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('garantirBoardPadrao', () => {
    it('deve criar os status iniciais na ordem definida', () => {
      const resultado = garantirBoardPadrao(banco);

      const status = listarStatusDoBoard(banco, resultado.boardId);
      expect(resultado.boardCriado).toBe(true);
      expect(status.map((item) => item.nome)).toEqual(NOMES_STATUS_ESPERADOS);
      expect(status.map((item) => item.posicao)).toEqual([0, 1, 2, 3]);
    });

    it('deve marcar apenas Concluídos como status que finaliza a atividade', () => {
      const { boardId } = garantirBoardPadrao(banco);

      const finalizadores = listarStatusDoBoard(banco, boardId)
        .filter((item) => item.finalizaAtividade)
        .map((item) => item.nome);

      expect(finalizadores).toEqual(['Concluídos']);
    });

    // O solicitante padrão é informado na configuração inicial; o board
    // nasce sem nenhum nome gravado.
    it('deve criar o board com o fuso padrão e sem solicitantes', () => {
      garantirBoardPadrao(banco);

      expect(contarLinhas(banco, 'solicitantes')).toBe(0);
      expect(contarLinhas(banco, 'atividades')).toBe(0);
      expect(buscarBoardPadrao(banco)?.fusoHorario).toBe(FUSO_HORARIO_PADRAO);
    });

    it('deve ser idempotente quando executado novamente', () => {
      const primeira = garantirBoardPadrao(banco);

      const segunda = garantirBoardPadrao(banco);

      expect(segunda).toEqual({
        boardId: primeira.boardId,
        boardCriado: false,
        statusCriados: 0,
      });
      expect(contarLinhas(banco, 'boards')).toBe(1);
      expect(contarLinhas(banco, 'status_board')).toBe(
        QUANTIDADE_STATUS_INICIAIS,
      );
    });

    it('não deve recriar status removido depois da criação do board', () => {
      const { boardId } = garantirBoardPadrao(banco);
      banco
        .delete(statusBoard)
        .where(eq(statusBoard.chave, 'bloqueados'))
        .run();

      garantirBoardPadrao(banco);

      expect(listarStatusDoBoard(banco, boardId)).toHaveLength(
        QUANTIDADE_STATUS_INICIAIS - 1,
      );
    });
  });

  describe('atualizarConfiguracaoBoard', () => {
    it('deve gravar a alteração e incrementar a versão', () => {
      const { boardId } = garantirBoardPadrao(banco);

      atualizarConfiguracaoBoard(banco, {
        boardId,
        versaoEsperada: VERSAO_INICIAL,
        nome: `  ${NOVO_NOME_BOARD}  `,
        fusoHorario: FUSO_HORARIO_PADRAO,
      });

      const board = banco.select().from(boards).get();
      expect(board?.nome).toBe(NOVO_NOME_BOARD);
      expect(board?.versao).toBe(VERSAO_INICIAL + 1);
    });

    it('deve recusar a alteração feita sobre uma versão desatualizada', () => {
      const { boardId } = garantirBoardPadrao(banco);
      const alteracao = {
        boardId,
        versaoEsperada: VERSAO_INICIAL,
        nome: NOVO_NOME_BOARD,
        fusoHorario: FUSO_HORARIO_PADRAO,
      };
      atualizarConfiguracaoBoard(banco, alteracao);

      expect(() => atualizarConfiguracaoBoard(banco, alteracao)).toThrow(
        expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }),
      );
    });

    it('deve recusar fuso horário desconhecido', () => {
      const { boardId } = garantirBoardPadrao(banco);

      expect(() =>
        atualizarConfiguracaoBoard(banco, {
          boardId,
          versaoEsperada: VERSAO_INICIAL,
          nome: NOVO_NOME_BOARD,
          fusoHorario: FUSO_INEXISTENTE,
        }),
      ).toThrow(expect.objectContaining({ codigo: 'fuso-horario-invalido' }));
    });
  });
});
