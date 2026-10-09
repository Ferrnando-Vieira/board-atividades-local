import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { listarIdsAtivosDoStatus } from '@/servidor/atividades/atividadesRepositorio';
import { moverAtividadeParaPosicao } from '@/servidor/atividades/atividadesServico';
import { esquemaMovimentoPorPosicao } from '@/servidor/atividades/esquemasAtividades';
import { listarStatusDoBoard } from '@/servidor/board/boardRepositorio';
import { moverStatusParaPosicao } from '@/servidor/board/statusServico';
import { listarSolicitantesGerenciaveis } from '@/servidor/classificacao/consultasClassificacao';
import { registrarSolicitante } from '@/servidor/classificacao/solicitantesServico';
import {
  criarBancoInicializado,
  SOLICITANTE_PADRAO_TESTE,
} from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  buscarAtividadeGravada,
  criarAtividadesNoStatus,
  exigirBoardId,
  exigirStatusPorChave,
} from '@/tests/suporte/fabricasAtividades';

describe('movimentos por posição', () => {
  let banco: BancoDados;
  let aFazerId: number;
  let concluidosId: number;
  let ids: number[];

  beforeEach(() => {
    banco = criarBancoInicializado();
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    concluidosId = exigirStatusPorChave(banco, 'concluidos').id;
    ids = criarAtividadesNoStatus(banco, aFazerId, ['A', 'B', 'C']);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('moverAtividadeParaPosicao', () => {
    it('deve inserir na posição pedida da própria coluna sem avançar a versão', () => {
      const [primeira = 0, , terceira = 0] = ids;

      const gravada = moverAtividadeParaPosicao(banco, {
        atividadeId: terceira,
        versaoEsperada: 1,
        statusDestinoId: aFazerId,
        posicao: 0,
      });

      expect(gravada.versao).toBe(1);
      expect(listarIdsAtivosDoStatus(banco, aFazerId)[0]).toBe(terceira);
      expect(listarIdsAtivosDoStatus(banco, aFazerId)[1]).toBe(primeira);
    });

    it('deve levar ao fim de outra coluna e aplicar a regra de conclusão', () => {
      const [primeira = 0] = ids;

      moverAtividadeParaPosicao(
        banco,
        {
          atividadeId: primeira,
          versaoEsperada: 1,
          statusDestinoId: concluidosId,
          posicao: null,
        },
        AGORA_TESTE,
      );

      expect(buscarAtividadeGravada(banco, primeira)).toEqual(
        expect.objectContaining({
          statusId: concluidosId,
          versao: 2,
          concluidaEmData: '2026-10-01',
        }),
      );
    });

    it('deve recusar versão desatualizada sem mexer na ordem', () => {
      const [primeira = 0] = ids;

      expect(() =>
        moverAtividadeParaPosicao(banco, {
          atividadeId: primeira,
          versaoEsperada: 9,
          statusDestinoId: aFazerId,
          posicao: 2,
        }),
      ).toThrow(expect.objectContaining({ codigo: 'conflito-de-versao' }));
      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual(ids);
    });

    it('deve recusar posição negativa no esquema', () => {
      expect(
        esquemaMovimentoPorPosicao.safeParse({
          atividadeId: 1,
          versaoEsperada: 1,
          statusDestinoId: aFazerId,
          posicao: -1,
        }).success,
      ).toBe(false);
    });
  });

  describe('moverStatusParaPosicao', () => {
    it('deve mudar a posição da coluna mantendo a ordem relativa das demais', () => {
      const ordemAntes = listarStatusDoBoard(banco, exigirBoardId(banco)).map(
        (status) => status.id,
      );

      moverStatusParaPosicao(banco, { statusId: concluidosId, posicao: 0 });

      expect(
        listarStatusDoBoard(banco, exigirBoardId(banco)).map(
          (status) => status.id,
        ),
      ).toEqual([
        concluidosId,
        ...ordemAntes.filter((id) => id !== concluidosId),
      ]);
    });
  });

  describe('registrarSolicitante', () => {
    it('deve cadastrar uma vez e reaproveitar variações de acento e caixa', () => {
      const primeiro = registrarSolicitante(banco, { nome: 'Logística' });
      const repetido = registrarSolicitante(banco, { nome: 'LOGISTICA' });

      expect(primeiro).toEqual(
        expect.objectContaining({ nome: 'Logística', criado: true }),
      );
      expect(repetido).toEqual({ ...primeiro, criado: false });
      expect(
        listarSolicitantesGerenciaveis(banco, exigirBoardId(banco)),
      ).toEqual([
        expect.objectContaining({
          nome: SOLICITANTE_PADRAO_TESTE,
          quantidadeAtividades: 3,
        }),
        expect.objectContaining({ nome: 'Logística', quantidadeAtividades: 0 }),
      ]);
    });
  });
});
