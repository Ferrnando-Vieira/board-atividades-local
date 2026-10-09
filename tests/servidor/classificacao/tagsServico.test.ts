import { eq } from 'drizzle-orm';
import { CODIGO_CONFLITO_VERSAO } from '@/servidor/banco/concorrencia';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  escopoLinkTags,
  linksCompartilhamento,
  tags,
} from '@/servidor/banco/esquema';
import { criarAtividade } from '@/servidor/atividades/atividadesServico';
import { esquemaEdicaoTag } from '@/servidor/classificacao/esquemasTags';
import {
  CODIGO_NOME_TAG_REPETIDO,
  CODIGO_TAG_COMPARTILHADA,
  CODIGO_TAG_INEXISTENTE,
  criarTag,
  editarTag,
  excluirTag,
} from '@/servidor/classificacao/tagsServico';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  buscarAtividadeGravada,
  exigirBoardId,
  exigirStatusPorChave,
  listarNomesTagsDaAtividade,
  montarDadosAtividade,
} from '@/tests/suporte/fabricasAtividades';

const VERSAO_INICIAL = 1;
const TAG_INEXISTENTE = 9999;
const HASH_FICTICIO = 'b'.repeat(64);

describe('tagsServico', () => {
  let banco: BancoDados;
  let atividadeId: number;

  function buscarTagId(nome: string): number {
    const tag = banco
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.nome, nome))
      .get();
    if (!tag) {
      throw new Error(`Tag ${nome} ausente.`);
    }
    return tag.id;
  }

  beforeEach(() => {
    banco = criarBancoInicializado();
    const aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    atividadeId = criarAtividade(
      banco,
      montarDadosAtividade(aFazerId, { tags: ['Faturas', 'Bugs'] }),
      AGORA_TESTE,
    ).atividadeId;
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('criarTag', () => {
    it('deve criar a tag com o nome normalizado', () => {
      const { tagId } = criarTag(banco, { nome: 'Reforma tributária' });

      expect(buscarTagId('Reforma tributária')).toBe(tagId);
    });

    it('deve recusar tag que já existe com outra grafia', () => {
      expect(() => criarTag(banco, { nome: 'FATURAS' })).toThrow(
        expect.objectContaining({ codigo: CODIGO_NOME_TAG_REPETIDO }),
      );
      expect(contarLinhas(banco, 'tags')).toBe(2);
    });
  });

  describe('editarTag', () => {
    it('deve renomear mantendo os vínculos e invalidando formulários abertos', () => {
      const tagId = buscarTagId('Faturas');

      editarTag(banco, { tagId, nomeAtual: 'Faturas', nome: 'Faturamento' });

      expect(listarNomesTagsDaAtividade(banco, atividadeId)).toEqual([
        'Bugs',
        'Faturamento',
      ]);
      expect(buscarAtividadeGravada(banco, atividadeId).versao).toBe(
        VERSAO_INICIAL + 1,
      );
    });

    it('deve permitir corrigir só a caixa do nome', () => {
      const tagId = buscarTagId('Bugs');

      editarTag(banco, { tagId, nomeAtual: 'Bugs', nome: 'BUGS' });

      expect(buscarTagId('BUGS')).toBe(tagId);
    });

    it('deve recusar nome já usado por outra tag', () => {
      const tagId = buscarTagId('Bugs');

      expect(() =>
        editarTag(banco, { tagId, nomeAtual: 'Bugs', nome: 'faturas' }),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_NOME_TAG_REPETIDO }));
    });

    it('deve recusar renomear a partir de um nome desatualizado', () => {
      const tagId = buscarTagId('Bugs');
      editarTag(banco, { tagId, nomeAtual: 'Bugs', nome: 'Defeitos' });

      expect(() =>
        editarTag(banco, { tagId, nomeAtual: 'Bugs', nome: 'Falhas' }),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }));
      expect(buscarTagId('Defeitos')).toBe(tagId);
    });

    it('deve recusar tag inexistente', () => {
      expect(() =>
        editarTag(banco, {
          tagId: TAG_INEXISTENTE,
          nomeAtual: 'Qualquer',
          nome: 'Outra',
        }),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_TAG_INEXISTENTE }));
    });
  });

  describe('excluirTag', () => {
    it('deve remover a tag e seus vínculos sem apagar a atividade', () => {
      const tagId = buscarTagId('Faturas');

      const resultado = excluirTag(banco, { tagId, nomeAtual: 'Faturas' });

      expect(resultado.atividadesAfetadas).toBe(1);
      expect(listarNomesTagsDaAtividade(banco, atividadeId)).toEqual(['Bugs']);
      expect(contarLinhas(banco, 'atividades')).toBe(1);
      expect(buscarAtividadeGravada(banco, atividadeId).versao).toBe(
        VERSAO_INICIAL + 1,
      );
    });

    it('deve recusar excluir a partir de um nome desatualizado', () => {
      const tagId = buscarTagId('Faturas');
      editarTag(banco, { tagId, nomeAtual: 'Faturas', nome: 'Faturamento' });

      expect(() => excluirTag(banco, { tagId, nomeAtual: 'Faturas' })).toThrow(
        expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }),
      );
      expect(contarLinhas(banco, 'tags')).toBe(2);
    });

    it('deve recusar excluir tag usada no escopo de um link de compartilhamento', () => {
      const tagId = buscarTagId('Bugs');
      const link = banco
        .insert(linksCompartilhamento)
        .values({
          boardId: exigirBoardId(banco),
          nome: 'Link',
          hashToken: HASH_FICTICIO,
        })
        .returning({ id: linksCompartilhamento.id })
        .get();
      banco.insert(escopoLinkTags).values({ linkId: link.id, tagId }).run();

      expect(() => excluirTag(banco, { tagId, nomeAtual: 'Bugs' })).toThrow(
        expect.objectContaining({ codigo: CODIGO_TAG_COMPARTILHADA }),
      );
      expect(listarNomesTagsDaAtividade(banco, atividadeId)).toContain('Bugs');
    });
  });

  describe('cor da tag', () => {
    function buscarCor(nome: string): string | null {
      return (
        banco
          .select({ cor: tags.cor })
          .from(tags)
          .where(eq(tags.nome, nome))
          .get()?.cor ?? null
      );
    }

    it('deve criar a tag com a cor escolhida', () => {
      criarTag(banco, { nome: 'Urgente', cor: '#dc2626' });

      expect(buscarCor('Urgente')).toBe('#dc2626');
    });

    it('deve criar sem cor (neutra) quando ela não é informada', () => {
      criarTag(banco, { nome: 'Neutra' });

      expect(buscarCor('Neutra')).toBeNull();
    });

    it('deve trocar só a cor sem invalidar a versão das atividades', () => {
      const tagId = buscarTagId('Faturas');

      editarTag(banco, {
        tagId,
        nomeAtual: 'Faturas',
        nome: 'Faturas',
        cor: '#bfdbfe',
      });

      expect(buscarCor('Faturas')).toBe('#bfdbfe');
      expect(buscarAtividadeGravada(banco, atividadeId).versao).toBe(
        VERSAO_INICIAL,
      );
    });

    it('deve voltar ao chip neutro com cor nula e manter a cor quando ausente', () => {
      const tagId = buscarTagId('Bugs');
      editarTag(banco, {
        tagId,
        nomeAtual: 'Bugs',
        nome: 'Bugs',
        cor: '#fecaca',
      });

      editarTag(banco, { tagId, nomeAtual: 'Bugs', nome: 'Defeitos' });
      expect(buscarCor('Defeitos')).toBe('#fecaca');

      editarTag(banco, {
        tagId,
        nomeAtual: 'Defeitos',
        nome: 'Defeitos',
        cor: null,
      });
      expect(buscarCor('Defeitos')).toBeNull();
    });

    it.each(['vermelho', '#abc', 'url(x)'])(
      'deve recusar a cor %p no formulário',
      (cor) => {
        const resultado = esquemaEdicaoTag.safeParse({
          tagId: '1',
          nomeAtual: 'Bugs',
          nome: 'Bugs',
          cor,
        });

        expect(resultado.success).toBe(false);
      },
    );

    it('deve tratar a cor vazia do formulário como neutra e normalizar maiúsculas', () => {
      const base = { tagId: '1', nomeAtual: 'Bugs', nome: 'Bugs' };

      expect(esquemaEdicaoTag.parse({ ...base, cor: '' }).cor).toBeNull();
      expect(esquemaEdicaoTag.parse({ ...base, cor: '#ABCDEF' }).cor).toBe(
        '#abcdef',
      );
    });
  });
});
