import {
  alterarCampo,
  HORAS_SUGESTAO_FUTURA,
  iniciarCamposDataHora,
  lerValorEnviado,
  lerValorExibido,
  limparCampos,
  soltarCampoVazio,
  sugerirMomentoLocal,
  usarSugestao,
} from '@/util/SugestaoDataHoraUtils';

const FUSO = 'America/Sao_Paulo';
const SUGESTAO = { data: '2026-10-05', hora: '19:40' };
const SEM_VINCULO = { vinculados: false };
const VINCULADOS = { vinculados: true };

describe('SugestaoDataHoraUtils', () => {
  describe('sugerirMomentoLocal', () => {
    it('deve sugerir hoje, quatro horas à frente, no fuso do board', () => {
      expect(
        sugerirMomentoLocal(
          new Date('2026-10-05T15:17:00Z'),
          HORAS_SUGESTAO_FUTURA,
          FUSO,
        ),
      ).toEqual({ data: '2026-10-05', hora: '16:17' });
    });

    it('deve levar a data junto quando o horário passa da meia-noite', () => {
      expect(
        sugerirMomentoLocal(
          new Date('2026-10-06T02:30:00Z'),
          HORAS_SUGESTAO_FUTURA,
          FUSO,
        ),
      ).toEqual({ data: '2026-10-06', hora: '03:30' });
    });

    it('deve sugerir o momento atual sem horas à frente', () => {
      expect(
        sugerirMomentoLocal(new Date('2026-10-05T15:17:00Z'), 0, FUSO),
      ).toEqual({ data: '2026-10-05', hora: '12:17' });
    });
  });

  describe('estado dos campos', () => {
    it('deve começar em sugestão só os campos vazios', () => {
      expect(iniciarCamposDataHora('2026-10-10', '')).toEqual({
        data: { valor: '2026-10-10', emUso: true },
        hora: { valor: '', emUso: false },
      });
    });

    it('não deve enviar a sugestão de um campo intocado', () => {
      const estado = iniciarCamposDataHora('', '');

      expect(lerValorEnviado(estado.data)).toBe('');
      expect(lerValorExibido(estado.data, SUGESTAO.data)).toBe(SUGESTAO.data);
    });

    it('deve usar só a data quando a hora é opcional', () => {
      const estado = usarSugestao(
        iniciarCamposDataHora('', ''),
        'data',
        SUGESTAO,
        SEM_VINCULO,
      );

      expect(lerValorEnviado(estado.data)).toBe(SUGESTAO.data);
      expect(lerValorEnviado(estado.hora)).toBe('');
    });

    it('deve usar também a data ao usar a hora, que depende dela', () => {
      const estado = usarSugestao(
        iniciarCamposDataHora('', ''),
        'hora',
        SUGESTAO,
        SEM_VINCULO,
      );

      expect(lerValorEnviado(estado.data)).toBe(SUGESTAO.data);
      expect(lerValorEnviado(estado.hora)).toBe(SUGESTAO.hora);
    });

    it('deve usar data e hora juntas quando são obrigatórias', () => {
      const estado = usarSugestao(
        iniciarCamposDataHora('', ''),
        'data',
        SUGESTAO,
        VINCULADOS,
      );

      expect(estado.hora).toEqual({ valor: SUGESTAO.hora, emUso: true });
    });

    it('não deve trocar um valor que já é da pessoa', () => {
      const estado = usarSugestao(
        iniciarCamposDataHora('2026-12-24', ''),
        'hora',
        SUGESTAO,
        SEM_VINCULO,
      );

      expect(estado.data.valor).toBe('2026-12-24');
    });

    it('deve gravar o valor digitado e usar a data junto com a hora', () => {
      const estado = alterarCampo(
        iniciarCamposDataHora('', ''),
        'hora',
        '08:15',
        SUGESTAO,
        SEM_VINCULO,
      );

      expect(lerValorEnviado(estado.hora)).toBe('08:15');
      expect(lerValorEnviado(estado.data)).toBe(SUGESTAO.data);
    });

    it('deve voltar à sugestão ao sair de uma data esvaziada, levando a hora', () => {
      const emUso = usarSugestao(
        iniciarCamposDataHora('', ''),
        'hora',
        SUGESTAO,
        SEM_VINCULO,
      );
      const esvaziada = alterarCampo(emUso, 'data', '', SUGESTAO, SEM_VINCULO);

      expect(lerValorEnviado(esvaziada.data)).toBe('');
      expect(esvaziada.data.emUso).toBe(true);
      expect(soltarCampoVazio(esvaziada, 'data', SEM_VINCULO)).toEqual(
        limparCampos(),
      );
    });

    it('deve soltar só a hora esvaziada quando a data continua', () => {
      const estado = alterarCampo(
        iniciarCamposDataHora('2026-12-24', '10:00'),
        'hora',
        '',
        SUGESTAO,
        SEM_VINCULO,
      );

      expect(soltarCampoVazio(estado, 'hora', SEM_VINCULO)).toEqual({
        data: { valor: '2026-12-24', emUso: true },
        hora: { valor: '', emUso: false },
      });
    });

    it('não deve mexer ao sair de um campo preenchido', () => {
      const estado = iniciarCamposDataHora('2026-12-24', '10:00');

      expect(soltarCampoVazio(estado, 'data', VINCULADOS)).toBe(estado);
    });
  });
});
