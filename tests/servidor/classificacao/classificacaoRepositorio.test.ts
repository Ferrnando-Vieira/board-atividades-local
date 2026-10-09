import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  buscarBoardPadrao,
  garantirBoardPadrao,
} from '@/servidor/board/boardRepositorio';
import {
  buscarSolicitantePadrao,
  CODIGO_SOLICITANTE_OBRIGATORIO,
  definirSolicitantePadrao,
  garantirSolicitante,
  garantirSolicitanteOuPadrao,
  garantirTag,
} from '@/servidor/classificacao/classificacaoRepositorio';
import {
  contarLinhas,
  criarBancoInicializado,
  criarBancoMigrado,
  SOLICITANTE_PADRAO_TESTE,
} from '@/tests/suporte/bancoTeste';

const VARIACOES_SOLICITANTE_PADRAO = [
  SOLICITANTE_PADRAO_TESTE,
  ' ana  exemplo ',
  'ANA EXEMPLO',
  'Âna Exêmplo',
];
const VARIACOES_TAG = [
  'Revisão técnica',
  'revisao  TECNICA',
  ' Revisão Técnica ',
];
const NOME_LONGO_DEMAIS = 'x'.repeat(61);

describe('classificacaoRepositorio', () => {
  let banco: BancoDados;
  let boardId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    boardId = buscarBoardPadrao(banco)?.id ?? 0;
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('garantirSolicitante', () => {
    it('deve reutilizar o solicitante para variações de caixa, espaço e acento', () => {
      const registros = VARIACOES_SOLICITANTE_PADRAO.map((nome) =>
        garantirSolicitante(banco, boardId, nome),
      );

      expect(new Set(registros.map((registro) => registro.id)).size).toBe(1);
      expect(registros.every((registro) => !registro.criado)).toBe(true);
      expect(contarLinhas(banco, 'solicitantes')).toBe(1);
    });

    it('deve criar um solicitante novo e informar que foi criado', () => {
      const registro = garantirSolicitante(banco, boardId, '  Financeiro ');

      expect(registro).toEqual(
        expect.objectContaining({ nome: 'Financeiro', criado: true }),
      );
    });

    it('deve recusar nome vazio', () => {
      expect(() => garantirSolicitante(banco, boardId, '   ')).toThrow(
        expect.objectContaining({ codigo: 'nome-vazio' }),
      );
    });
  });

  describe('garantirTag', () => {
    it('deve manter uma única tag e o nome da primeira gravação', () => {
      const registros = VARIACOES_TAG.map((nome) =>
        garantirTag(banco, boardId, nome),
      );

      expect(new Set(registros.map((registro) => registro.id)).size).toBe(1);
      expect(registros.map((registro) => registro.criado)).toEqual([
        true,
        false,
        false,
      ]);
      expect(
        registros.every((registro) => registro.nome === 'Revisão técnica'),
      ).toBe(true);
    });

    it('deve recusar nome acima do limite de caracteres', () => {
      expect(() => garantirTag(banco, boardId, NOME_LONGO_DEMAIS)).toThrow(
        expect.objectContaining({ codigo: 'nome-longo' }),
      );
    });

    it('deve impedir duplicata pelo índice único mesmo em inserção direta', () => {
      garantirTag(banco, boardId, 'Infra');

      expect(() =>
        banco.$client
          .prepare(
            "INSERT INTO tags (board_id, nome, nome_normalizado) VALUES (?, 'infra', 'infra')",
          )
          .run(boardId),
      ).toThrow('UNIQUE constraint failed');
    });
  });

  describe('solicitante padrão', () => {
    it('deve passar a marca de padrão para o nome informado, mantendo o anterior', () => {
      const registro = definirSolicitantePadrao(banco, boardId, ' Financeiro ');

      expect(registro).toEqual(
        expect.objectContaining({ nome: 'Financeiro', criado: true }),
      );
      expect(buscarSolicitantePadrao(banco, boardId)?.nome).toBe('Financeiro');
      expect(contarLinhas(banco, 'solicitantes')).toBe(2);
      expect(
        banco.$client
          .prepare('SELECT count(*) AS n FROM solicitantes WHERE padrao = 1')
          .get(),
      ).toEqual({ n: 1 });
    });

    it('deve reutilizar o cadastro existente ao definir uma variação do nome', () => {
      definirSolicitantePadrao(banco, boardId, 'Financeiro');

      const registro = definirSolicitantePadrao(banco, boardId, 'ANA exemplo');

      expect(registro.criado).toBe(false);
      expect(buscarSolicitantePadrao(banco, boardId)?.nome).toBe(
        SOLICITANTE_PADRAO_TESTE,
      );
      expect(contarLinhas(banco, 'solicitantes')).toBe(2);
    });

    it('deve usar o padrão quando o nome é nulo e o nome quando informado', () => {
      expect(garantirSolicitanteOuPadrao(banco, boardId, null).nome).toBe(
        SOLICITANTE_PADRAO_TESTE,
      );
      expect(
        garantirSolicitanteOuPadrao(banco, boardId, 'Financeiro').nome,
      ).toBe('Financeiro');
    });

    it('deve exigir o nome quando o board não tem solicitante padrão', () => {
      const semPadrao = criarBancoMigrado();
      const { boardId: idSemPadrao } = garantirBoardPadrao(semPadrao);
      try {
        expect(buscarSolicitantePadrao(semPadrao, idSemPadrao)).toBeUndefined();
        expect(() =>
          garantirSolicitanteOuPadrao(semPadrao, idSemPadrao, null),
        ).toThrow(
          expect.objectContaining({ codigo: CODIGO_SOLICITANTE_OBRIGATORIO }),
        );
        expect(contarLinhas(semPadrao, 'solicitantes')).toBe(0);
      } finally {
        fecharBanco(semPadrao);
      }
    });

    it('deve impedir dois padrões no mesmo board pelo índice único', () => {
      expect(() =>
        banco.$client
          .prepare(
            "INSERT INTO solicitantes (board_id, nome, nome_normalizado, padrao) VALUES (?, 'Outro', 'outro', 1)",
          )
          .run(boardId),
      ).toThrow('UNIQUE constraint failed');
    });
  });
});
