import { sugerirSolicitante } from '@/screens/atividades/valoresFormularioAtividade';

const PADROES_TAGS = { infra: 'Bruno Infra', portal: 'Carla Portal' };

describe('valoresFormularioAtividade', () => {
  describe('sugerirSolicitante', () => {
    it('deve sugerir o padrão da primeira tag adicionada que tiver um', () => {
      expect(
        sugerirSolicitante(['Sem dono', 'Portal', 'Infra'], PADROES_TAGS, null),
      ).toEqual({ nome: 'Carla Portal', tag: 'Portal' });
    });

    it('deve comparar as tags sem caixa nem acento', () => {
      expect(sugerirSolicitante(['ÍNFRA'], PADROES_TAGS, 'Ana')).toEqual({
        nome: 'Bruno Infra',
        tag: 'ÍNFRA',
      });
    });

    it('deve cair no padrão do board, ou em branco sem ele', () => {
      expect(sugerirSolicitante(['Sem dono'], PADROES_TAGS, 'Ana')).toEqual({
        nome: 'Ana',
        tag: null,
      });
      expect(sugerirSolicitante([], PADROES_TAGS, null)).toEqual({
        nome: '',
        tag: null,
      });
    });
  });
});
