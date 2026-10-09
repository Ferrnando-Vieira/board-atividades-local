import { calcularSituacaoPrazo } from '@/util/PrazoUtils';

const AGORA = { data: '2026-10-01', hora: '13:30' };

describe('PrazoUtils', () => {
  describe('calcularSituacaoPrazo', () => {
    it('deve retornar null quando não há prazo', () => {
      expect(
        calcularSituacaoPrazo({ prazoData: null, prazoHora: null }, AGORA),
      ).toBeNull();
    });

    it('deve marcar como vencido o prazo de data anterior', () => {
      expect(
        calcularSituacaoPrazo(
          { prazoData: '2026-09-30', prazoHora: '23:59' },
          AGORA,
        ),
      ).toBe('vencido');
    });

    it('deve marcar como próximo o prazo de amanhã', () => {
      expect(
        calcularSituacaoPrazo(
          { prazoData: '2026-10-02', prazoHora: null },
          AGORA,
        ),
      ).toBe('proximo');
    });

    it('deve marcar como próximo o último dia da janela de aviso', () => {
      expect(
        calcularSituacaoPrazo(
          { prazoData: '2026-10-03', prazoHora: '08:00' },
          AGORA,
        ),
      ).toBe('proximo');
    });

    it('deve marcar como no prazo a data depois da janela de aviso', () => {
      expect(
        calcularSituacaoPrazo(
          { prazoData: '2026-10-04', prazoHora: null },
          AGORA,
        ),
      ).toBe('no-prazo');
    });

    it('deve atravessar a virada de mês ao calcular a janela', () => {
      expect(
        calcularSituacaoPrazo(
          { prazoData: '2026-11-01', prazoHora: null },
          { data: '2026-10-31', hora: '09:00' },
        ),
      ).toBe('proximo');
    });

    it('deve marcar como hoje o prazo de hoje sem hora', () => {
      expect(
        calcularSituacaoPrazo(
          { prazoData: '2026-10-01', prazoHora: null },
          AGORA,
        ),
      ).toBe('hoje');
    });

    it('deve marcar como hoje o prazo de hoje com hora ainda por vir', () => {
      expect(
        calcularSituacaoPrazo(
          { prazoData: '2026-10-01', prazoHora: '13:30' },
          AGORA,
        ),
      ).toBe('hoje');
    });

    it('deve marcar como vencido o prazo de hoje cuja hora já passou', () => {
      expect(
        calcularSituacaoPrazo(
          { prazoData: '2026-10-01', prazoHora: '13:29' },
          AGORA,
        ),
      ).toBe('vencido');
    });
  });
});
