import { LIMITES_COLECAO } from '@/config/constantes';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  arquivarAtividade,
  criarAtividade,
  desvincularTagAtividade,
  editarAtividade,
  vincularTagAtividade,
} from '@/servidor/atividades/atividadesServico';
import { esquemaVinculoTag } from '@/servidor/atividades/esquemasAtividades';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  buscarAtividadeGravada,
  exigirStatusPorChave,
  listarNomesTagsDaAtividade,
  montarDadosAtividade,
} from '@/tests/suporte/fabricasAtividades';
import { exigirIdTag } from '@/tests/suporte/fabricasCompartilhamento';

const VERSAO_INICIAL = 1;

describe('tags rápidas do cartão', () => {
  let banco: BancoDados;
  let aFazerId: number;
  let atividadeId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    atividadeId = criarAtividade(
      banco,
      montarDadosAtividade(aFazerId, { tags: ['Faturas'] }),
      AGORA_TESTE,
    ).atividadeId;
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('vincularTagAtividade', () => {
    it('deve criar a tag nova, vinculá-la e avançar a versão', () => {
      const resultado = vincularTagAtividade(banco, {
        atividadeId,
        nome: 'Reforma tributária',
      });

      expect(resultado.versao).toBe(VERSAO_INICIAL + 1);
      expect(listarNomesTagsDaAtividade(banco, atividadeId)).toEqual([
        'Faturas',
        'Reforma tributária',
      ]);
    });

    it('deve reaproveitar a tag equivalente sem duplicar por caixa, acento ou espaços', () => {
      const tagsAntes = contarLinhas(banco, 'tags');

      vincularTagAtividade(banco, {
        atividadeId,
        nome: '  reforma   TRIBUTARIA ',
      });
      vincularTagAtividade(banco, { atividadeId, nome: 'Reforma tributária' });

      expect(contarLinhas(banco, 'tags')).toBe(tagsAntes + 1);
      expect(listarNomesTagsDaAtividade(banco, atividadeId)).toHaveLength(2);
    });

    it('deve ser idempotente e não mudar a versão quando a tag já está no cartão', () => {
      const resultado = vincularTagAtividade(banco, {
        atividadeId,
        nome: 'faturas',
      });

      expect(resultado.versao).toBe(VERSAO_INICIAL);
      expect(buscarAtividadeGravada(banco, atividadeId).versao).toBe(
        VERSAO_INICIAL,
      );
    });

    it('deve recusar além do limite de tags sem criar a tag nova', () => {
      const limite = Array.from(
        { length: LIMITES_COLECAO.TAGS_POR_ATIVIDADE },
        (_, indice) => `Tag ${indice}`,
      );
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, { tags: limite }),
          atividadeId,
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );
      const tagsAntes = contarLinhas(banco, 'tags');

      expect(() =>
        vincularTagAtividade(banco, { atividadeId, nome: 'Excedente' }),
      ).toThrow(expect.objectContaining({ codigo: 'limite-de-tags' }));

      expect(contarLinhas(banco, 'tags')).toBe(tagsAntes);
    });

    it('deve recusar atividade arquivada', () => {
      arquivarAtividade(
        banco,
        { atividadeId, versaoEsperada: VERSAO_INICIAL },
        AGORA_TESTE,
      );

      expect(() =>
        vincularTagAtividade(banco, { atividadeId, nome: 'Nova' }),
      ).toThrow(expect.objectContaining({ codigo: 'atividade-arquivada' }));
    });

    it('deve fazer um formulário de edição aberto antes perceber a mudança', () => {
      vincularTagAtividade(banco, { atividadeId, nome: 'Nova' });

      expect(() =>
        editarAtividade(
          banco,
          {
            ...montarDadosAtividade(aFazerId, { tags: ['Faturas'] }),
            atividadeId,
            versaoEsperada: VERSAO_INICIAL,
          },
          AGORA_TESTE,
        ),
      ).toThrow(expect.objectContaining({ codigo: 'conflito-de-versao' }));
      expect(listarNomesTagsDaAtividade(banco, atividadeId)).toContain('Nova');
    });
  });

  describe('desvincularTagAtividade', () => {
    it('deve remover o vínculo, manter a tag cadastrada e avançar a versão', () => {
      const tagId = exigirIdTag(banco, 'Faturas');

      const resultado = desvincularTagAtividade(banco, { atividadeId, tagId });

      expect(resultado.versao).toBe(VERSAO_INICIAL + 1);
      expect(listarNomesTagsDaAtividade(banco, atividadeId)).toEqual([]);
      expect(exigirIdTag(banco, 'Faturas')).toBe(tagId);
    });

    it('deve ser idempotente quando a tag não está no cartão', () => {
      const resultado = desvincularTagAtividade(banco, {
        atividadeId,
        tagId: 9999,
      });

      expect(resultado.versao).toBe(VERSAO_INICIAL);
    });
  });

  describe('esquemaVinculoTag', () => {
    it.each(['', '   ', 'x'.repeat(61)])('deve recusar o nome %p', (nome) => {
      expect(esquemaVinculoTag.safeParse({ atividadeId, nome }).success).toBe(
        false,
      );
    });

    it('deve recusar campos extras na carga', () => {
      expect(
        esquemaVinculoTag.safeParse({ atividadeId, nome: 'Ok', versao: 3 })
          .success,
      ).toBe(false);
    });
  });
});
