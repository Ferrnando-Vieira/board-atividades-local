import { FUSO_HORARIO_PADRAO } from '@/config/constantes';
import {
  descreverSituacaoLembrete,
  listarOperacoesLembrete,
  type DadosLembreteExibido,
} from '@/screens/atividades/descricaoLembrete';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { formatarInstanteParaExibicao } from '@/util/DataUtils';

const AGORA = new Date('2026-10-01T15:00:00.000Z');
const FUTURO = '2026-10-02T12:30:00.000Z';
const PASSADO = '2026-10-01T14:00:00.000Z';
const DISPARO = '2026-10-01T14:00:20.000Z';

const SEM_LEMBRETE: DadosLembreteExibido = {
  lembreteEm: null,
  lembreteSituacao: null,
  lembreteDisparadoEm: null,
  lembreteDispensadoEm: null,
  arquivada: false,
};

function descrever(dados: Partial<DadosLembreteExibido>) {
  return descreverSituacaoLembrete(
    { ...SEM_LEMBRETE, ...dados },
    AGORA,
    FUSO_HORARIO_PADRAO,
  );
}

describe('descricaoLembrete', () => {
  describe('descreverSituacaoLembrete', () => {
    it('deve indicar que não há lembrete', () => {
      expect(descrever({})).toEqual({
        resumo: textosAtividades.semLembrete,
        detalhe: null,
      });
    });

    it('deve descrever lembrete ativo no futuro sem detalhe', () => {
      const descricao = descrever({
        lembreteEm: FUTURO,
        lembreteSituacao: 'pendente',
      });

      expect(descricao).toEqual({
        resumo: textosAtividades.descreverLembrete(
          formatarInstanteParaExibicao(FUTURO, FUSO_HORARIO_PADRAO),
          textosAtividades.situacoesLembrete.pendente,
        ),
        detalhe: null,
      });
    });

    it('deve avisar que o ativo vencido aparece como atrasado', () => {
      const descricao = descrever({
        lembreteEm: PASSADO,
        lembreteSituacao: 'pendente',
      });

      expect(descricao.detalhe).toBe(
        textosAtividades.detalhesLembrete.pendenteVencido,
      );
    });

    it('deve avisar que atividade arquivada não dispara', () => {
      const descricao = descrever({
        lembreteEm: PASSADO,
        lembreteSituacao: 'pendente',
        arquivada: true,
      });

      expect(descricao.detalhe).toBe(
        textosAtividades.detalhesLembrete.arquivadaPendente,
      );
    });

    it.each([
      [FUTURO, textosAtividades.detalhesLembrete.desativado],
      [PASSADO, textosAtividades.detalhesLembrete.desativadoVencido],
    ])('deve orientar o lembrete desativado em %s', (lembreteEm, detalhe) => {
      const descricao = descrever({
        lembreteEm,
        lembreteSituacao: 'cancelado',
      });

      expect(descricao.detalhe).toBe(detalhe);
    });

    it('deve identificar o lembrete histórico sem momento de disparo', () => {
      const descricao = descrever({
        lembreteEm: PASSADO,
        lembreteSituacao: 'disparado',
      });

      expect(descricao.detalhe).toBe(
        textosAtividades.detalhesLembrete.semMomentoDisparo,
      );
    });

    it('deve indicar o disparo aguardando leitura', () => {
      const descricao = descrever({
        lembreteEm: PASSADO,
        lembreteSituacao: 'disparado',
        lembreteDisparadoEm: DISPARO,
      });

      expect(descricao.detalhe).toBe(
        textosAtividades.detalhesLembrete.disparadoAguardando(
          formatarInstanteParaExibicao(DISPARO, FUSO_HORARIO_PADRAO),
        ),
      );
    });

    it('deve indicar o disparo já dispensado', () => {
      const descricao = descrever({
        lembreteEm: PASSADO,
        lembreteSituacao: 'disparado',
        lembreteDisparadoEm: DISPARO,
        lembreteDispensadoEm: AGORA.toISOString(),
      });

      expect(descricao.detalhe).toBe(
        textosAtividades.detalhesLembrete.disparadoDispensado(
          formatarInstanteParaExibicao(DISPARO, FUSO_HORARIO_PADRAO),
        ),
      );
    });
  });

  describe('listarOperacoesLembrete', () => {
    it.each([
      [null, null, []],
      [FUTURO, 'pendente', ['desativar', 'excluir']],
      [FUTURO, 'cancelado', ['ativar', 'excluir']],
      [PASSADO, 'cancelado', ['excluir']],
      [PASSADO, 'disparado', ['excluir']],
    ] as const)(
      'deve oferecer para %p em %p as ações %p',
      (lembreteEm, lembreteSituacao, esperadas) => {
        const operacoes = listarOperacoesLembrete(
          { lembreteEm, lembreteSituacao },
          AGORA,
        );

        expect(operacoes).toEqual(esperadas);
      },
    );
  });
});
