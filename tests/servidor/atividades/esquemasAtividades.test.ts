import { LIMITES_COLECAO, LIMITES_TEXTO } from '@/config/constantes';
import {
  esquemaEdicaoAtividade,
  esquemaMovimentoAtividade,
  esquemaNovaAtividade,
} from '@/servidor/atividades/esquemasAtividades';
import { mensagensAtividades } from '@/servidor/atividades/mensagensAtividades';

const FORMULARIO_MINIMO = {
  titulo: '  Revisar relatório  ',
  descricao: '',
  prioridade: '',
  statusId: '3',
  solicitante: '',
  tags: [],
  prazoData: '',
  prazoHora: '',
  concluidaEmData: '',
  concluidaEmHora: '',
};

function errosDoCampo(resultado: { error?: { issues: unknown[] } }) {
  return resultado.error?.issues ?? [];
}

describe('esquemasAtividades', () => {
  describe('esquemaNovaAtividade', () => {
    // Solicitante em branco vira nulo: o serviço grava o padrão do board.
    it('deve aplicar os valores padrão aos campos em branco', () => {
      const resultado = esquemaNovaAtividade.parse(FORMULARIO_MINIMO);

      expect(resultado).toEqual({
        titulo: 'Revisar relatório',
        descricao: null,
        prioridade: 5,
        statusId: 3,
        solicitante: null,
        tags: [],
        prazoData: null,
        prazoHora: null,
        concluidaEmData: null,
        concluidaEmHora: null,
      });
    });

    it('deve normalizar o solicitante e remover tags repetidas', () => {
      const resultado = esquemaNovaAtividade.parse({
        ...FORMULARIO_MINIMO,
        solicitante: '  Diretoria   financeira ',
        tags: ['Faturas', ' faturas ', 'Infra', '   '],
      });

      expect(resultado.solicitante).toBe('Diretoria financeira');
      expect(resultado.tags).toEqual(['Faturas', 'Infra']);
    });

    it('deve recusar título vazio com mensagem própria', () => {
      const resultado = esquemaNovaAtividade.safeParse({
        ...FORMULARIO_MINIMO,
        titulo: '   ',
      });

      expect(resultado.success).toBe(false);
      expect(errosDoCampo(resultado)).toEqual([
        expect.objectContaining({
          path: ['titulo'],
          message: mensagensAtividades.tituloObrigatorio,
        }),
      ]);
    });

    it('deve recusar título acima do limite', () => {
      const resultado = esquemaNovaAtividade.safeParse({
        ...FORMULARIO_MINIMO,
        titulo: 'x'.repeat(LIMITES_TEXTO.TITULO_ATIVIDADE + 1),
      });

      expect(resultado.success).toBe(false);
    });

    it.each(['-1', '10', '2.5', 'alta'])(
      'deve recusar prioridade fora de 0 a 9 (%p)',
      (prioridade) => {
        const resultado = esquemaNovaAtividade.safeParse({
          ...FORMULARIO_MINIMO,
          prioridade,
        });

        expect(resultado.success).toBe(false);
      },
    );

    it.each([
      ['0', 0],
      ['9', 9],
    ])('deve aceitar a prioridade limite %p', (prioridade, esperada) => {
      const resultado = esquemaNovaAtividade.parse({
        ...FORMULARIO_MINIMO,
        prioridade,
      });

      expect(resultado.prioridade).toBe(esperada);
    });

    it('deve recusar data inexistente no calendário', () => {
      const resultado = esquemaNovaAtividade.safeParse({
        ...FORMULARIO_MINIMO,
        prazoData: '2026-02-30',
      });

      expect(resultado.success).toBe(false);
    });

    it('deve exigir data quando a hora do prazo é informada', () => {
      const resultado = esquemaNovaAtividade.safeParse({
        ...FORMULARIO_MINIMO,
        prazoHora: '10:00',
      });

      expect(errosDoCampo(resultado)).toEqual([
        expect.objectContaining({
          path: ['prazoData'],
          message: mensagensAtividades.horaSemData,
        }),
      ]);
    });

    it('deve recusar mais tags que o limite', () => {
      const tags = Array.from(
        { length: LIMITES_COLECAO.TAGS_POR_ATIVIDADE + 1 },
        (_, indice) => `Tag ${indice}`,
      );

      const resultado = esquemaNovaAtividade.safeParse({
        ...FORMULARIO_MINIMO,
        tags,
      });

      expect(errosDoCampo(resultado)).toEqual([
        expect.objectContaining({ message: mensagensAtividades.tagsDemais }),
      ]);
    });

    it('deve recusar status ausente', () => {
      const resultado = esquemaNovaAtividade.safeParse({
        ...FORMULARIO_MINIMO,
        statusId: '',
      });

      expect(errosDoCampo(resultado)).toEqual([
        expect.objectContaining({ path: ['statusId'] }),
      ]);
    });
  });

  describe('esquemaEdicaoAtividade', () => {
    it('deve exigir identificador e versão válidos', () => {
      const resultado = esquemaEdicaoAtividade.safeParse({
        ...FORMULARIO_MINIMO,
        atividadeId: 'abc',
        versaoEsperada: '0',
      });

      expect(resultado.success).toBe(false);
    });

    it('deve converter identificador e versão do formulário em números', () => {
      const resultado = esquemaEdicaoAtividade.parse({
        ...FORMULARIO_MINIMO,
        atividadeId: '12',
        versaoEsperada: '3',
      });

      expect(resultado.atividadeId).toBe(12);
      expect(resultado.versaoEsperada).toBe(3);
    });
  });

  describe('esquemaMovimentoAtividade', () => {
    const MOVIMENTO_VALIDO = {
      atividadeId: 7,
      versaoEsperada: 2,
      statusDestinoId: 1,
      ordemDestino: [4, 7, 9],
    };

    it('deve aceitar um movimento bem formado', () => {
      expect(esquemaMovimentoAtividade.parse(MOVIMENTO_VALIDO)).toEqual(
        MOVIMENTO_VALIDO,
      );
    });

    it('deve recusar ordem sem a atividade movida', () => {
      const resultado = esquemaMovimentoAtividade.safeParse({
        ...MOVIMENTO_VALIDO,
        ordemDestino: [4, 9],
      });

      expect(resultado.success).toBe(false);
    });

    it('deve recusar ordem com identificadores repetidos', () => {
      const resultado = esquemaMovimentoAtividade.safeParse({
        ...MOVIMENTO_VALIDO,
        ordemDestino: [7, 4, 4],
      });

      expect(resultado.success).toBe(false);
    });

    it('deve recusar campos extras e tipos textuais', () => {
      expect(
        esquemaMovimentoAtividade.safeParse({
          ...MOVIMENTO_VALIDO,
          prioridade: 0,
        }).success,
      ).toBe(false);
      expect(
        esquemaMovimentoAtividade.safeParse({
          ...MOVIMENTO_VALIDO,
          atividadeId: '7',
        }).success,
      ).toBe(false);
    });
  });
});
