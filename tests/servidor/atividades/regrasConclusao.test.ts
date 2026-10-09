import {
  definirConclusaoDoFormulario,
  definirConclusaoDoMovimento,
  SEM_CONCLUSAO,
} from '@/servidor/atividades/regrasConclusao';

const AGORA = { data: '2026-10-01', hora: '12:00' };
const CONCLUSAO_ORIGINAL = {
  concluidaEmData: '2026-09-23',
  concluidaEmHora: null,
};
const CONCLUSAO_AGORA = {
  concluidaEmData: '2026-10-01',
  concluidaEmHora: '12:00',
};

describe('regrasConclusao', () => {
  describe('definirConclusaoDoFormulario', () => {
    it('deve limpar a conclusão quando o status não finaliza', () => {
      expect(
        definirConclusaoDoFormulario(false, CONCLUSAO_ORIGINAL, AGORA),
      ).toEqual(SEM_CONCLUSAO);
    });

    it('deve manter a data informada quando o status finaliza', () => {
      expect(
        definirConclusaoDoFormulario(true, CONCLUSAO_ORIGINAL, AGORA),
      ).toEqual(CONCLUSAO_ORIGINAL);
    });

    it('deve registrar o momento atual quando a data fica em branco', () => {
      expect(definirConclusaoDoFormulario(true, SEM_CONCLUSAO, AGORA)).toEqual(
        CONCLUSAO_AGORA,
      );
    });
  });

  describe('definirConclusaoDoMovimento', () => {
    it('não deve alterar a conclusão quando o status não muda', () => {
      expect(
        definirConclusaoDoMovimento(false, false, CONCLUSAO_ORIGINAL, AGORA),
      ).toEqual(CONCLUSAO_ORIGINAL);
    });

    it('deve limpar a conclusão ao ir para um status que não finaliza', () => {
      expect(
        definirConclusaoDoMovimento(false, true, CONCLUSAO_ORIGINAL, AGORA),
      ).toEqual(SEM_CONCLUSAO);
    });

    it('deve preservar a data original entre status que finalizam', () => {
      expect(
        definirConclusaoDoMovimento(true, true, CONCLUSAO_ORIGINAL, AGORA),
      ).toEqual(CONCLUSAO_ORIGINAL);
    });

    it('deve registrar o momento atual ao entrar num status que finaliza', () => {
      expect(
        definirConclusaoDoMovimento(true, true, SEM_CONCLUSAO, AGORA),
      ).toEqual(CONCLUSAO_AGORA);
    });
  });
});
