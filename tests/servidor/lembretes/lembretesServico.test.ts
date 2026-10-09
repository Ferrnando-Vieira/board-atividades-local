import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CODIGO_CONFLITO_VERSAO } from '@/servidor/banco/concorrencia';
import {
  abrirBanco,
  fecharBanco,
  type BancoDados,
} from '@/servidor/banco/conexao';
import { atividades } from '@/servidor/banco/esquema';
import { aplicarMigracoes } from '@/servidor/banco/migrador';
import { CODIGO_ATIVIDADE_ARQUIVADA } from '@/servidor/atividades/atividadesRepositorio';
import { arquivarAtividade } from '@/servidor/atividades/atividadesServico';
import { garantirBoardPadrao } from '@/servidor/board/boardRepositorio';
import { esquemaDefinicaoLembrete } from '@/servidor/lembretes/esquemasLembretes';
import {
  ativarLembrete,
  CODIGOS_LEMBRETE,
  definirLembrete,
  desativarLembrete,
  dispararLembretesVencidos,
  dispensarLembrete,
  excluirLembrete,
  listarLembretesADispensar,
  sincronizarLembretes,
} from '@/servidor/lembretes/lembretesServico';
import { somarMinutos } from '@/util/DataUtils';
import { STATUS_ERRO } from '@/util/ErroApp';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  buscarAtividadeGravada,
  criarAtividadesNoStatus,
  exigirStatusPorChave,
} from '@/tests/suporte/fabricasAtividades';

// AGORA_TESTE é 01/10/2026 12:00 em America/Sao_Paulo (15:00 UTC).
const DATA_AMANHA = '2026-10-02';
const HORA_MANHA = '09:30';
const INSTANTE_AMANHA_UTC = '2026-10-02T12:30:00.000Z';
const INSTANTE_PASSADO_UTC = '2026-10-01T14:00:00.000Z';
const INSTANTE_FUTURO_UTC = '2026-10-01T18:00:00.000Z';
const MINUTOS_APOS_HORARIO = 1;

describe('lembretesServico', () => {
  let banco: BancoDados;
  let atividadeId: number;
  let outraAtividadeId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    [atividadeId = 0, outraAtividadeId = 0] = criarAtividadesNoStatus(
      banco,
      exigirStatusPorChave(banco, 'a-fazer').id,
      ['Ligar para o financeiro', 'Enviar relatório'],
    );
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function definirPadrao(versaoEsperada = 1, id = atividadeId) {
    return definirLembrete(
      banco,
      {
        atividadeId: id,
        versaoEsperada,
        lembreteData: DATA_AMANHA,
        lembreteHora: HORA_MANHA,
      },
      AGORA_TESTE,
    );
  }

  function gravarLembreteDireto(
    id: number,
    valores: Partial<typeof atividades.$inferInsert>,
  ): void {
    banco.update(atividades).set(valores).where(eq(atividades.id, id)).run();
  }

  describe('definirLembrete', () => {
    it('deve gravar o instante em UTC a partir do fuso do board e avançar a versão', () => {
      const gravado = definirPadrao();

      const atividade = buscarAtividadeGravada(banco, atividadeId);
      expect(gravado).toEqual({ atividadeId, versao: 2 });
      expect(atividade).toEqual(
        expect.objectContaining({
          lembreteEm: INSTANTE_AMANHA_UTC,
          lembreteSituacao: 'pendente',
          lembreteDisparadoEm: null,
          lembreteDispensadoEm: null,
          versao: 2,
        }),
      );
    });

    it('deve recusar horário que já passou sem alterar a atividade', () => {
      expect(() =>
        definirLembrete(
          banco,
          {
            atividadeId,
            versaoEsperada: 1,
            lembreteData: '2026-10-01',
            lembreteHora: '11:59',
          },
          AGORA_TESTE,
        ),
      ).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_LEMBRETE.NO_PASSADO,
          status: STATUS_ERRO.REQUISICAO_INVALIDA,
        }),
      );
      expect(buscarAtividadeGravada(banco, atividadeId)).toEqual(
        expect.objectContaining({ lembreteEm: null, versao: 1 }),
      );
    });

    it('deve recusar o próprio minuto atual como horário', () => {
      expect(() =>
        definirLembrete(
          banco,
          {
            atividadeId,
            versaoEsperada: 1,
            lembreteData: '2026-10-01',
            lembreteHora: '12:00',
          },
          AGORA_TESTE,
        ),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGOS_LEMBRETE.NO_PASSADO }),
      );
    });

    it('deve recusar versão desatualizada da atividade', () => {
      definirPadrao();

      expect(() => definirPadrao(1)).toThrow(
        expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }),
      );
    });

    it('deve recusar lembrete em atividade arquivada', () => {
      arquivarAtividade(banco, { atividadeId, versaoEsperada: 1 }, AGORA_TESTE);

      expect(() => definirPadrao(2)).toThrow(
        expect.objectContaining({ codigo: CODIGO_ATIVIDADE_ARQUIVADA }),
      );
    });

    it('deve remarcar um lembrete disparado como novo aviso pendente', () => {
      gravarLembreteDireto(atividadeId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'disparado',
        lembreteDisparadoEm: INSTANTE_PASSADO_UTC,
        lembreteDispensadoEm: AGORA_TESTE.toISOString(),
      });

      definirPadrao();

      expect(buscarAtividadeGravada(banco, atividadeId)).toEqual(
        expect.objectContaining({
          lembreteEm: INSTANTE_AMANHA_UTC,
          lembreteSituacao: 'pendente',
          lembreteDisparadoEm: null,
          lembreteDispensadoEm: null,
        }),
      );
    });
  });

  describe('esquemaDefinicaoLembrete', () => {
    const BASE = { atividadeId: '1', versaoEsperada: '1' };

    it('deve aceitar data e hora válidas', () => {
      const resultado = esquemaDefinicaoLembrete.safeParse({
        ...BASE,
        lembreteData: DATA_AMANHA,
        lembreteHora: HORA_MANHA,
      });

      expect(resultado.success).toBe(true);
    });

    it.each([
      ['2026-02-30', HORA_MANHA, 'lembreteData'],
      ['2026-13-01', HORA_MANHA, 'lembreteData'],
      ['', HORA_MANHA, 'lembreteData'],
      ['01/10/2026', HORA_MANHA, 'lembreteData'],
      [DATA_AMANHA, '24:00', 'lembreteHora'],
      [DATA_AMANHA, '9:5', 'lembreteHora'],
      [DATA_AMANHA, '', 'lembreteHora'],
    ])(
      'deve recusar data "%s" com hora "%s" no campo %s',
      (lembreteData, lembreteHora, campo) => {
        const resultado = esquemaDefinicaoLembrete.safeParse({
          ...BASE,
          lembreteData,
          lembreteHora,
        });

        expect(resultado.success).toBe(false);
        expect(
          resultado.error?.issues.map((problema) => problema.path[0]),
        ).toContain(campo);
      },
    );
  });

  describe('ativar, desativar e excluir', () => {
    it('deve desativar um lembrete pendente', () => {
      definirPadrao();

      const gravado = desativarLembrete(banco, {
        atividadeId,
        versaoEsperada: 2,
      });

      expect(gravado.versao).toBe(3);
      expect(buscarAtividadeGravada(banco, atividadeId).lembreteSituacao).toBe(
        'cancelado',
      );
    });

    it('deve manter sem alteração a desativação de um lembrete já desativado', () => {
      definirPadrao();
      desativarLembrete(banco, { atividadeId, versaoEsperada: 2 });

      const gravado = desativarLembrete(banco, {
        atividadeId,
        versaoEsperada: 3,
      });

      expect(gravado.versao).toBe(3);
    });

    it('deve recusar desativar um lembrete já disparado', () => {
      gravarLembreteDireto(atividadeId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'disparado',
        lembreteDisparadoEm: INSTANTE_PASSADO_UTC,
      });

      expect(() =>
        desativarLembrete(banco, { atividadeId, versaoEsperada: 1 }),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGOS_LEMBRETE.JA_DISPARADO }),
      );
    });

    it('deve reativar um lembrete desativado cujo horário ainda é futuro', () => {
      definirPadrao();
      desativarLembrete(banco, { atividadeId, versaoEsperada: 2 });

      ativarLembrete(banco, { atividadeId, versaoEsperada: 3 }, AGORA_TESTE);

      expect(buscarAtividadeGravada(banco, atividadeId).lembreteSituacao).toBe(
        'pendente',
      );
    });

    it('deve recusar reativar um lembrete vencido', () => {
      gravarLembreteDireto(atividadeId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'cancelado',
      });

      expect(() =>
        ativarLembrete(banco, { atividadeId, versaoEsperada: 1 }, AGORA_TESTE),
      ).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_LEMBRETE.VENCIDO,
          status: STATUS_ERRO.CONFLITO,
        }),
      );
    });

    it('deve recusar reativar quando a atividade não tem lembrete', () => {
      expect(() =>
        ativarLembrete(banco, { atividadeId, versaoEsperada: 1 }, AGORA_TESTE),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGOS_LEMBRETE.INEXISTENTE }),
      );
    });

    it('deve excluir o lembrete limpando todos os campos', () => {
      definirPadrao();

      excluirLembrete(banco, { atividadeId, versaoEsperada: 2 });

      expect(buscarAtividadeGravada(banco, atividadeId)).toEqual(
        expect.objectContaining({
          lembreteEm: null,
          lembreteSituacao: null,
          lembreteDisparadoEm: null,
          lembreteDispensadoEm: null,
          versao: 3,
        }),
      );
    });

    it('deve recusar excluir quando não há lembrete', () => {
      expect(() =>
        excluirLembrete(banco, { atividadeId, versaoEsperada: 1 }),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGOS_LEMBRETE.INEXISTENTE }),
      );
    });
  });

  describe('dispararLembretesVencidos', () => {
    it('deve disparar só lembretes pendentes, vencidos e de atividades ativas', () => {
      const [canceladoId = 0, arquivadoId = 0] = criarAtividadesNoStatus(
        banco,
        exigirStatusPorChave(banco, 'a-fazer').id,
        ['Lembrete desativado', 'Lembrete de arquivada'],
      );
      gravarLembreteDireto(atividadeId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'pendente',
      });
      gravarLembreteDireto(outraAtividadeId, {
        lembreteEm: INSTANTE_FUTURO_UTC,
        lembreteSituacao: 'pendente',
      });
      gravarLembreteDireto(canceladoId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'cancelado',
      });
      gravarLembreteDireto(arquivadoId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'pendente',
        arquivadaEm: INSTANTE_PASSADO_UTC,
      });

      const disparados = dispararLembretesVencidos(banco, AGORA_TESTE);

      expect(disparados.map((aviso) => aviso.atividadeId)).toEqual([
        atividadeId,
      ]);
      expect(buscarAtividadeGravada(banco, atividadeId)).toEqual(
        expect.objectContaining({
          lembreteSituacao: 'disparado',
          lembreteDisparadoEm: AGORA_TESTE.toISOString(),
        }),
      );
      expect(buscarAtividadeGravada(banco, arquivadoId).lembreteSituacao).toBe(
        'pendente',
      );
    });

    it('deve disparar cada lembrete uma única vez', () => {
      gravarLembreteDireto(atividadeId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'pendente',
      });

      const primeira = dispararLembretesVencidos(banco, AGORA_TESTE);
      const segunda = dispararLembretesVencidos(
        banco,
        somarMinutos(AGORA_TESTE, MINUTOS_APOS_HORARIO),
      );

      expect(primeira).toHaveLength(1);
      expect(segunda).toEqual([]);
    });

    it('deve marcar como atrasado o disparo feito além da tolerância', () => {
      gravarLembreteDireto(atividadeId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'pendente',
      });
      gravarLembreteDireto(outraAtividadeId, {
        lembreteEm: somarMinutos(
          AGORA_TESTE,
          -MINUTOS_APOS_HORARIO,
        ).toISOString(),
        lembreteSituacao: 'pendente',
      });

      const disparados = dispararLembretesVencidos(banco, AGORA_TESTE);

      expect(
        Object.fromEntries(
          disparados.map((aviso) => [aviso.atividadeId, aviso.atrasado]),
        ),
      ).toEqual({ [atividadeId]: true, [outraAtividadeId]: false });
    });

    it('deve preservar a versão e o momento de atualização da atividade', () => {
      gravarLembreteDireto(atividadeId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'pendente',
      });
      const antes = buscarAtividadeGravada(banco, atividadeId);

      dispararLembretesVencidos(banco, AGORA_TESTE);

      const depois = buscarAtividadeGravada(banco, atividadeId);
      expect(depois.versao).toBe(antes.versao);
      expect(depois.atualizadoEm).toBe(antes.atualizadoEm);
    });
  });

  describe('disparo com duas conexões ao mesmo arquivo', () => {
    let diretorio: string;

    beforeEach(() => {
      diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'board-lembretes-'));
    });

    afterEach(() => {
      fs.rmSync(diretorio, { recursive: true, force: true });
    });

    it('deve entregar o aviso a uma única conexão', () => {
      const caminho = path.join(diretorio, 'board.sqlite');
      const primeiraConexao = abrirBanco(caminho);
      aplicarMigracoes(primeiraConexao);
      garantirBoardPadrao(primeiraConexao);
      const [id = 0] = criarAtividadesNoStatus(
        primeiraConexao,
        exigirStatusPorChave(primeiraConexao, 'a-fazer').id,
        ['Aviso compartilhado'],
      );
      primeiraConexao
        .update(atividades)
        .set({ lembreteEm: INSTANTE_PASSADO_UTC, lembreteSituacao: 'pendente' })
        .where(eq(atividades.id, id))
        .run();
      const segundaConexao = abrirBanco(caminho, {
        exigirArquivoExistente: true,
      });

      const daPrimeira = dispararLembretesVencidos(
        primeiraConexao,
        AGORA_TESTE,
      );
      const daSegunda = dispararLembretesVencidos(segundaConexao, AGORA_TESTE);
      fecharBanco(segundaConexao);
      fecharBanco(primeiraConexao);

      expect(daPrimeira).toHaveLength(1);
      expect(daSegunda).toEqual([]);
    });
  });

  describe('listagem e dispensa', () => {
    beforeEach(() => {
      gravarLembreteDireto(atividadeId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'pendente',
      });
      dispararLembretesVencidos(banco, AGORA_TESTE);
    });

    it('deve listar o aviso disparado até ser dispensado', () => {
      const lista = listarLembretesADispensar(banco);

      expect(lista).toEqual([
        {
          atividadeId,
          titulo: 'Ligar para o financeiro',
          lembreteEm: INSTANTE_PASSADO_UTC,
          disparadoEm: AGORA_TESTE.toISOString(),
          atrasado: true,
        },
      ]);
    });

    it('deve deixar de fora os lembretes históricos gravados como disparados', () => {
      gravarLembreteDireto(outraAtividadeId, {
        lembreteEm: '2026-09-29T18:15:00.000Z',
        lembreteSituacao: 'disparado',
        lembreteDisparadoEm: null,
      });

      const lista = listarLembretesADispensar(banco);

      expect(lista.map((aviso) => aviso.atividadeId)).toEqual([atividadeId]);
    });

    it('deve dispensar uma única vez e preservar a versão', () => {
      const versaoAntes = buscarAtividadeGravada(banco, atividadeId).versao;

      const primeira = dispensarLembrete(
        banco,
        { atividadeId, lembreteEm: INSTANTE_PASSADO_UTC },
        AGORA_TESTE,
      );
      const segunda = dispensarLembrete(
        banco,
        { atividadeId, lembreteEm: INSTANTE_PASSADO_UTC },
        AGORA_TESTE,
      );

      expect(primeira).toBe(true);
      expect(segunda).toBe(false);
      expect(listarLembretesADispensar(banco)).toEqual([]);
      expect(buscarAtividadeGravada(banco, atividadeId).versao).toBe(
        versaoAntes,
      );
    });

    it('não deve dispensar um aviso cujo lembrete foi remarcado', () => {
      const dispensado = dispensarLembrete(
        banco,
        { atividadeId, lembreteEm: INSTANTE_FUTURO_UTC },
        AGORA_TESTE,
      );

      expect(dispensado).toBe(false);
      expect(listarLembretesADispensar(banco)).toHaveLength(1);
    });

    it('deve sincronizar devolvendo novas e a lista completa a dispensar', () => {
      gravarLembreteDireto(outraAtividadeId, {
        lembreteEm: INSTANTE_PASSADO_UTC,
        lembreteSituacao: 'pendente',
      });

      const sincronizacao = sincronizarLembretes(banco, AGORA_TESTE);

      expect(sincronizacao.novas.map((aviso) => aviso.atividadeId)).toEqual([
        outraAtividadeId,
      ]);
      expect(sincronizacao.aDispensar).toHaveLength(2);
    });
  });
});
