import { CODIGO_CONFLITO_VERSAO } from '@/servidor/banco/concorrencia';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  esquemaEdicaoLembreteAvulso,
  esquemaNovoLembreteAvulso,
} from '@/servidor/lembretes/esquemasLembretes';
import {
  cancelarLembreteAvulso,
  CODIGO_LEMBRETE_AVULSO_INEXISTENTE,
  criarLembreteAvulso,
  dispararLembretesAvulsosVencidos,
  dispensarLembreteAvulso,
  editarLembreteAvulso,
  excluirLembreteAvulso,
  listarLembretesAvulsos,
  listarLembretesAvulsosADispensar,
  listarProximosLembretesAvulsos,
  reativarLembreteAvulso,
} from '@/servidor/lembretes/lembretesAvulsosServico';
import { CODIGOS_LEMBRETE } from '@/servidor/lembretes/lembretesServico';
import { somarMinutos } from '@/util/DataUtils';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import { AGORA_TESTE } from '@/tests/suporte/fabricasAtividades';

// AGORA_TESTE é 01/10/2026 12:00 em America/Sao_Paulo (15:00 UTC).
const DATA_HOJE = '2026-10-01';
const DATA_AMANHA = '2026-10-02';
const HORA_TARDE = '15:00';
const HORA_MANHA = '09:30';
const INSTANTE_HOJE_TARDE_UTC = '2026-10-01T18:00:00.000Z';
const INSTANTE_AMANHA_UTC = '2026-10-02T12:30:00.000Z';
const MINUTOS_APOS_HORARIO = 1;
const ATRASO_MINUTOS = 10;
const LIMITE_PROXIMOS = 20;
const VERSAO_INICIAL = 1;

const NOVO_LEMBRETE = {
  titulo: 'Ligar para o fornecedor',
  observacao: 'Confirmar a entrega',
  lembreteData: DATA_HOJE,
  lembreteHora: HORA_TARDE,
};

describe('lembretesAvulsosServico', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function criar(dados = NOVO_LEMBRETE): number {
    return criarLembreteAvulso(banco, dados, AGORA_TESTE).lembreteId;
  }

  function buscar(lembreteId: number) {
    const lembrete = listarLembretesAvulsos(banco).find(
      (item) => item.id === lembreteId,
    );
    if (!lembrete) {
      throw new Error(`Lembrete ${lembreteId} ausente.`);
    }
    return lembrete;
  }

  it('deve criar um lembrete pendente sem atividade, no fuso do board', () => {
    const lembreteId = criar();

    expect(buscar(lembreteId)).toEqual(
      expect.objectContaining({
        titulo: 'Ligar para o fornecedor',
        observacao: 'Confirmar a entrega',
        lembreteEm: INSTANTE_HOJE_TARDE_UTC,
        situacao: 'pendente',
        versao: VERSAO_INICIAL,
      }),
    );
  });

  it('deve recusar horário que já passou', () => {
    expect(() => criar({ ...NOVO_LEMBRETE, lembreteHora: '11:59' })).toThrow(
      expect.objectContaining({ codigo: CODIGOS_LEMBRETE.NO_PASSADO }),
    );
  });

  it('deve disparar uma única vez e listar para dispensar', () => {
    const lembreteId = criar();
    const depois = somarMinutos(
      new Date(INSTANTE_HOJE_TARDE_UTC),
      MINUTOS_APOS_HORARIO,
    );

    const primeira = dispararLembretesAvulsosVencidos(banco, depois);
    const segunda = dispararLembretesAvulsosVencidos(banco, depois);

    expect(primeira).toEqual([
      expect.objectContaining({
        lembreteId,
        lembreteEm: INSTANTE_HOJE_TARDE_UTC,
        atrasado: false,
      }),
    ]);
    expect(segunda).toEqual([]);
    expect(listarLembretesAvulsosADispensar(banco)).toHaveLength(1);
    expect(buscar(lembreteId).versao).toBe(VERSAO_INICIAL);
  });

  it('deve marcar como atrasado o disparo depois da tolerância', () => {
    criar();
    const muitoDepois = somarMinutos(
      new Date(INSTANTE_HOJE_TARDE_UTC),
      ATRASO_MINUTOS,
    );

    const [notificacao] = dispararLembretesAvulsosVencidos(banco, muitoDepois);

    expect(notificacao?.atrasado).toBe(true);
  });

  it('não deve disparar antes do horário', () => {
    criar();

    expect(dispararLembretesAvulsosVencidos(banco, AGORA_TESTE)).toEqual([]);
  });

  it('deve dispensar pelo instante exibido, de forma idempotente', () => {
    const lembreteId = criar();
    const depois = somarMinutos(
      new Date(INSTANTE_HOJE_TARDE_UTC),
      MINUTOS_APOS_HORARIO,
    );
    dispararLembretesAvulsosVencidos(banco, depois);

    const errado = dispensarLembreteAvulso(
      banco,
      { lembreteId, lembreteEm: INSTANTE_AMANHA_UTC },
      depois,
    );
    const certo = dispensarLembreteAvulso(
      banco,
      { lembreteId, lembreteEm: INSTANTE_HOJE_TARDE_UTC },
      depois,
    );
    const repetido = dispensarLembreteAvulso(
      banco,
      { lembreteId, lembreteEm: INSTANTE_HOJE_TARDE_UTC },
      depois,
    );

    expect([errado, certo, repetido]).toEqual([false, true, false]);
    expect(listarLembretesAvulsosADispensar(banco)).toEqual([]);
  });

  it('deve remarcar ao editar, voltando a pendente mesmo depois de disparar', () => {
    const lembreteId = criar();
    dispararLembretesAvulsosVencidos(
      banco,
      somarMinutos(new Date(INSTANTE_HOJE_TARDE_UTC), MINUTOS_APOS_HORARIO),
    );

    editarLembreteAvulso(
      banco,
      {
        lembreteId,
        versaoEsperada: VERSAO_INICIAL,
        titulo: 'Ligar de novo',
        observacao: null,
        lembreteData: DATA_AMANHA,
        lembreteHora: HORA_MANHA,
      },
      AGORA_TESTE,
    );

    expect(buscar(lembreteId)).toEqual(
      expect.objectContaining({
        titulo: 'Ligar de novo',
        observacao: null,
        lembreteEm: INSTANTE_AMANHA_UTC,
        situacao: 'pendente',
        disparadoEm: null,
        versao: VERSAO_INICIAL + 1,
      }),
    );
  });

  it('deve recusar edição com versão desatualizada', () => {
    const lembreteId = criar();
    cancelarLembreteAvulso(banco, {
      lembreteId,
      versaoEsperada: VERSAO_INICIAL,
    });

    expect(() =>
      excluirLembreteAvulso(banco, {
        lembreteId,
        versaoEsperada: VERSAO_INICIAL,
      }),
    ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }));
  });

  it('deve desativar, não disparar desativado e reativar se ainda for futuro', () => {
    const lembreteId = criar();

    cancelarLembreteAvulso(banco, {
      lembreteId,
      versaoEsperada: VERSAO_INICIAL,
    });
    const disparos = dispararLembretesAvulsosVencidos(
      banco,
      somarMinutos(new Date(INSTANTE_HOJE_TARDE_UTC), MINUTOS_APOS_HORARIO),
    );
    reativarLembreteAvulso(
      banco,
      { lembreteId, versaoEsperada: VERSAO_INICIAL + 1 },
      AGORA_TESTE,
    );

    expect(disparos).toEqual([]);
    expect(buscar(lembreteId).situacao).toBe('pendente');
  });

  it('não deve reativar um lembrete cujo horário já passou', () => {
    const lembreteId = criar();
    cancelarLembreteAvulso(banco, {
      lembreteId,
      versaoEsperada: VERSAO_INICIAL,
    });

    expect(() =>
      reativarLembreteAvulso(
        banco,
        { lembreteId, versaoEsperada: VERSAO_INICIAL + 1 },
        new Date(INSTANTE_AMANHA_UTC),
      ),
    ).toThrow(expect.objectContaining({ codigo: CODIGOS_LEMBRETE.VENCIDO }));
  });

  it('não deve desativar um lembrete já disparado', () => {
    const lembreteId = criar();
    dispararLembretesAvulsosVencidos(
      banco,
      somarMinutos(new Date(INSTANTE_HOJE_TARDE_UTC), MINUTOS_APOS_HORARIO),
    );

    expect(() =>
      cancelarLembreteAvulso(banco, {
        lembreteId,
        versaoEsperada: VERSAO_INICIAL,
      }),
    ).toThrow(
      expect.objectContaining({ codigo: CODIGOS_LEMBRETE.JA_DISPARADO }),
    );
  });

  it('deve excluir e depois informar que o lembrete não existe', () => {
    const lembreteId = criar();

    excluirLembreteAvulso(banco, {
      lembreteId,
      versaoEsperada: VERSAO_INICIAL,
    });

    expect(listarLembretesAvulsos(banco)).toEqual([]);
    expect(() =>
      excluirLembreteAvulso(banco, {
        lembreteId,
        versaoEsperada: VERSAO_INICIAL,
      }),
    ).toThrow(
      expect.objectContaining({ codigo: CODIGO_LEMBRETE_AVULSO_INEXISTENTE }),
    );
  });

  it('deve listar os próximos pendentes em ordem de horário', () => {
    const depois = criar({
      ...NOVO_LEMBRETE,
      titulo: 'Amanhã',
      lembreteData: DATA_AMANHA,
      lembreteHora: HORA_MANHA,
    });
    const antes = criar();

    expect(
      listarProximosLembretesAvulsos(banco, AGORA_TESTE, LIMITE_PROXIMOS).map(
        (lembrete) => lembrete.id,
      ),
    ).toEqual([antes, depois]);
  });

  describe('esquemas', () => {
    it('deve normalizar o título e tratar observação vazia como nula', () => {
      expect(
        esquemaNovoLembreteAvulso.parse({
          ...NOVO_LEMBRETE,
          titulo: '  Ligar   para   o fornecedor ',
          observacao: '   ',
        }),
      ).toEqual(
        expect.objectContaining({
          titulo: 'Ligar para o fornecedor',
          observacao: null,
        }),
      );
    });

    it.each([
      ['titulo', ''],
      ['titulo', 'x'.repeat(121)],
      ['observacao', 'x'.repeat(501)],
      ['lembreteData', '01/10/2026'],
      ['lembreteHora', '25:00'],
    ])('deve recusar %s = %p', (campo, valor) => {
      const resultado = esquemaNovoLembreteAvulso.safeParse({
        ...NOVO_LEMBRETE,
        [campo]: valor,
      });

      expect(resultado.success).toBe(false);
    });

    it('deve exigir identificador e versão na edição', () => {
      expect(esquemaEdicaoLembreteAvulso.safeParse(NOVO_LEMBRETE).success).toBe(
        false,
      );
    });
  });
});
