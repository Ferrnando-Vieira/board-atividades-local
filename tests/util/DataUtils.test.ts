import {
  converterHorarioLocalParaUtc,
  formatarDataComHoraOpcional,
  formatarDataParaExibicao,
  formatarInstanteParaExibicao,
  obterMomentoLocal,
} from '@/util/DataUtils';

const FUSO_SAO_PAULO = 'America/Sao_Paulo';
const FUSO_NOVA_YORK = 'America/New_York';

describe('DataUtils', () => {
  describe('converterHorarioLocalParaUtc', () => {
    it.each([
      ['2026-09-30', '13:45', FUSO_SAO_PAULO, '2026-09-30T16:45:00.000Z'],
      ['2026-09-29', '15:15', FUSO_SAO_PAULO, '2026-09-29T18:15:00.000Z'],
      ['2026-12-31', '23:30', FUSO_SAO_PAULO, '2027-01-01T02:30:00.000Z'],
      ['2026-07-01', '12:00', FUSO_NOVA_YORK, '2026-07-01T16:00:00.000Z'],
      ['2026-01-15', '12:00', FUSO_NOVA_YORK, '2026-01-15T17:00:00.000Z'],
    ])('deve converter %s %s em %s para %s', (data, hora, fuso, esperado) => {
      const instante = converterHorarioLocalParaUtc(data, hora, fuso);

      expect(instante.toISOString()).toBe(esperado);
    });

    it('deve recusar hora fora do formato HH:MM', () => {
      expect(() =>
        converterHorarioLocalParaUtc('2026-09-30', '24:00', FUSO_SAO_PAULO),
      ).toThrow('Hora inválida');
    });
  });

  describe('formatarDataParaExibicao', () => {
    it('deve formatar a data no padrão dd/mm/aaaa', () => {
      expect(formatarDataParaExibicao('2026-09-25')).toBe('25/09/2026');
    });

    it('deve recusar texto fora do formato ISO', () => {
      expect(() => formatarDataParaExibicao('25/09/2026')).toThrow(
        'Data inválida',
      );
    });
  });

  describe('formatarInstanteParaExibicao', () => {
    it('deve exibir o instante UTC no horário do fuso informado', () => {
      const texto = formatarInstanteParaExibicao(
        '2026-09-30T16:45:00.000Z',
        FUSO_SAO_PAULO,
      );

      expect(texto).toContain('13:45');
      expect(texto).toContain('30/09/2026');
    });
  });

  describe('obterMomentoLocal', () => {
    it.each([
      ['2026-10-01T15:00:00.000Z', FUSO_SAO_PAULO, '2026-10-01', '12:00'],
      ['2026-10-02T02:30:00.000Z', FUSO_SAO_PAULO, '2026-10-01', '23:30'],
      ['2027-01-01T02:59:00.000Z', FUSO_SAO_PAULO, '2026-12-31', '23:59'],
      ['2026-07-01T16:05:00.000Z', FUSO_NOVA_YORK, '2026-07-01', '12:05'],
    ])(
      'deve converter %s em %s para %s %s',
      (instante, fuso, dataEsperada, horaEsperada) => {
        const momento = obterMomentoLocal(new Date(instante), fuso);

        expect(momento).toEqual({ data: dataEsperada, hora: horaEsperada });
      },
    );
  });

  describe('formatarDataComHoraOpcional', () => {
    it('deve incluir a hora quando informada', () => {
      expect(formatarDataComHoraOpcional('2026-10-01', '14:00')).toBe(
        '01/10/2026 14:00',
      );
    });

    it('deve exibir só a data quando não há hora', () => {
      expect(formatarDataComHoraOpcional('2026-10-01', null)).toBe(
        '01/10/2026',
      );
    });
  });
});
