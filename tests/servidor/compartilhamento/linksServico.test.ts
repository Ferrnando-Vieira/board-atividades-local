import { eq } from 'drizzle-orm';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  escopoLinkSolicitantes,
  escopoLinkTags,
  linksCompartilhamento,
} from '@/servidor/banco/esquema';
import { validarTokenCompartilhamento } from '@/servidor/compartilhamento/acessoCompartilhamento';
import {
  consultarTokensLinks,
  definirAnimalLink,
  editarLinkCompartilhamento,
  listarLinksCompartilhamento,
  revogarLinkCompartilhamento,
  tornarEnderecoCopiavel,
} from '@/servidor/compartilhamento/linksServico';
import { garantirLinkPadrao } from '@/servidor/compartilhamento/linkPadrao';
import { excluirTag } from '@/servidor/classificacao/tagsServico';
import { calcularHashToken } from '@/servidor/seguranca/tokens';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import { AGORA_TESTE, exigirBoardId } from '@/tests/suporte/fabricasAtividades';
import {
  CHAVE_LINKS_TESTE,
  criarCenarioEscopo,
  criarLinkDeTeste,
  exigirIdSolicitante,
  exigirIdTag,
} from '@/tests/suporte/fabricasCompartilhamento';

const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const DIAS_VALIDADE = 7;
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const TAG_INEXISTENTE = 999_999;

function lerLinhasLinks(banco: BancoDados): Record<string, unknown>[] {
  return banco.$client
    .prepare('SELECT * FROM links_compartilhamento')
    .all() as Record<string, unknown>[];
}

describe('links de compartilhamento', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
    criarCenarioEscopo(banco);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('criarLinkCompartilhamento', () => {
    it('deve gerar token aleatório de 256 bits e guardar só o SHA-256', () => {
      const primeiro = criarLinkDeTeste(banco, {
        tagIds: [exigirIdTag(banco, 'Faturas')],
      });
      const segundo = criarLinkDeTeste(banco, {
        tagIds: [exigirIdTag(banco, 'Faturas')],
      });

      const linhas = lerLinhasLinks(banco);

      expect(primeiro.token).toMatch(FORMATO_TOKEN);
      expect(primeiro.token).not.toBe(segundo.token);
      expect(linhas.map((linha) => linha.hash_token)).toEqual([
        calcularHashToken(primeiro.token),
        calcularHashToken(segundo.token),
      ]);
      expect(JSON.stringify(linhas)).not.toContain(primeiro.token);
      expect(JSON.stringify(linhas)).not.toContain(segundo.token);
    });

    it('deve gravar o escopo do link restrito', () => {
      const tagId = exigirIdTag(banco, 'Faturas');
      const solicitanteId = exigirIdSolicitante(banco, 'Financeiro');

      const { linkId } = criarLinkDeTeste(banco, {
        tagIds: [tagId],
        solicitanteIds: [solicitanteId],
      });

      expect(
        banco
          .select()
          .from(escopoLinkTags)
          .where(eq(escopoLinkTags.linkId, linkId))
          .all(),
      ).toEqual([{ linkId, tagId }]);
      expect(
        banco
          .select()
          .from(escopoLinkSolicitantes)
          .where(eq(escopoLinkSolicitantes.linkId, linkId))
          .all(),
      ).toEqual([{ linkId, solicitanteId }]);
    });

    it('deve calcular a expiração a partir da validade em dias', () => {
      const { expiraEm } = criarLinkDeTeste(banco, {
        modalidade: 'completo',
        incluirArquivadas: true,
        validadeDias: DIAS_VALIDADE,
      });

      expect(expiraEm).toBe(
        new Date(
          AGORA_TESTE.getTime() + DIAS_VALIDADE * MILISSEGUNDOS_POR_DIA,
        ).toISOString(),
      );
    });

    it('deve recusar tag inexistente sem gravar o link', () => {
      expect(() =>
        criarLinkDeTeste(banco, { tagIds: [TAG_INEXISTENTE] }),
      ).toThrow(expect.objectContaining({ codigo: 'escopo-inexistente' }));

      expect(contarLinhas(banco, 'links_compartilhamento')).toBe(0);
    });
  });

  describe('listarLinksCompartilhamento', () => {
    it('deve listar escopo e situação sem expor o hash do token', () => {
      criarLinkDeTeste(banco, {
        nome: 'Financeiro',
        tagIds: [exigirIdTag(banco, 'Faturas')],
        solicitanteIds: [exigirIdSolicitante(banco, 'Financeiro')],
      });

      const [link] = listarLinksCompartilhamento(
        banco,
        exigirBoardId(banco),
        AGORA_TESTE,
      );

      expect(link).toEqual(
        expect.objectContaining({
          nome: 'Financeiro',
          modalidade: 'restrito',
          situacao: 'ativo',
          tags: [expect.objectContaining({ nome: 'Faturas' })],
          solicitantes: [expect.objectContaining({ nome: 'Financeiro' })],
        }),
      );
      expect(Object.keys(link ?? {})).not.toContain('hashToken');
    });

    it('deve mostrar ativos antes de expirados e esconder os revogados', () => {
      const expirado = criarLinkDeTeste(
        banco,
        { nome: 'Expirado', modalidade: 'completo', validadeDias: 1 },
        new Date('2026-09-01T12:00:00.000Z'),
      );
      const revogado = criarLinkDeTeste(banco, {
        nome: 'Revogado',
        modalidade: 'completo',
      });
      criarLinkDeTeste(banco, { nome: 'Ativo', modalidade: 'completo' });
      revogarLinkCompartilhamento(banco, { linkId: revogado.linkId });

      const situacoes = listarLinksCompartilhamento(
        banco,
        exigirBoardId(banco),
        AGORA_TESTE,
      ).map((link) => [link.nome, link.situacao]);

      expect(situacoes).toEqual([
        ['Ativo', 'ativo'],
        ['Expirado', 'expirado'],
      ]);
      expect(expirado.expiraEm).not.toBeNull();
    });
  });

  describe('endereço copiável', () => {
    it('deve reconstruir o endereço dos links ativos a partir da chave', () => {
      const link = criarLinkDeTeste(banco, { modalidade: 'completo' });
      const revogado = criarLinkDeTeste(banco, { modalidade: 'completo' });
      revogarLinkCompartilhamento(banco, { linkId: revogado.linkId });

      const tokens = consultarTokensLinks(
        banco,
        exigirBoardId(banco),
        CHAVE_LINKS_TESTE,
      );

      expect([...tokens]).toEqual([[link.linkId, link.token]]);
      expect(validarTokenCompartilhamento(banco, link.token)).not.toBeNull();
    });

    it('não deve reconstruir com outra chave', () => {
      criarLinkDeTeste(banco, { modalidade: 'completo' });

      expect(
        consultarTokensLinks(banco, exigirBoardId(banco), Buffer.alloc(32, 1))
          .size,
      ).toBe(0);
    });

    it('deve trocar o endereço de um link antigo pelo derivado, invalidando o anterior', () => {
      const link = criarLinkDeTeste(banco, { modalidade: 'completo' });
      const tokenAntigo = 'A'.repeat(43);
      banco
        .update(linksCompartilhamento)
        .set({ hashToken: calcularHashToken(tokenAntigo) })
        .where(eq(linksCompartilhamento.id, link.linkId))
        .run();

      const novo = tornarEnderecoCopiavel(
        banco,
        { linkId: link.linkId },
        CHAVE_LINKS_TESTE,
      );

      expect(novo).toBe(link.token);
      expect(validarTokenCompartilhamento(banco, tokenAntigo)).toBeNull();
      expect(validarTokenCompartilhamento(banco, novo)).not.toBeNull();
    });
  });

  describe('editarLinkCompartilhamento', () => {
    it('deve trocar nome, modalidade, escopo e validade mantendo o endereço', () => {
      const diretoria = exigirIdTag(banco, 'Diretoria');
      const link = criarLinkDeTeste(banco, { modalidade: 'completo' });

      editarLinkCompartilhamento(
        banco,
        {
          linkId: link.linkId,
          nome: 'Diretoria',
          modalidade: 'restrito',
          tagIds: [diretoria],
          solicitanteIds: [],
          incluirArquivadas: false,
          validadeDias: DIAS_VALIDADE,
        },
        AGORA_TESTE,
      );

      const [editado] = listarLinksCompartilhamento(
        banco,
        exigirBoardId(banco),
        AGORA_TESTE,
      );
      expect(editado).toEqual(
        expect.objectContaining({
          nome: 'Diretoria',
          modalidade: 'restrito',
          tags: [{ id: diretoria, nome: 'Diretoria' }],
          expiraEm: new Date(
            AGORA_TESTE.getTime() + DIAS_VALIDADE * MILISSEGUNDOS_POR_DIA,
          ).toISOString(),
        }),
      );
      expect(
        validarTokenCompartilhamento(banco, link.token, AGORA_TESTE),
      ).toEqual(
        expect.objectContaining({ nome: 'Diretoria', modalidade: 'restrito' }),
      );
    });

    it('deve manter a validade quando ela não é enviada', () => {
      const link = criarLinkDeTeste(banco, {
        modalidade: 'completo',
        validadeDias: DIAS_VALIDADE,
      });

      editarLinkCompartilhamento(banco, {
        linkId: link.linkId,
        nome: 'Renomeado',
        modalidade: 'completo',
        tagIds: [],
        solicitanteIds: [],
        incluirArquivadas: true,
        validadeDias: undefined,
      });

      expect(
        listarLinksCompartilhamento(banco, exigirBoardId(banco))[0]?.expiraEm,
      ).toBe(link.expiraEm);
    });

    it('deve recusar link revogado e o link padrão', () => {
      const link = criarLinkDeTeste(banco, { modalidade: 'completo' });
      revogarLinkCompartilhamento(banco, { linkId: link.linkId });
      const padrao = garantirLinkPadrao(banco, CHAVE_LINKS_TESTE);
      const edicao = {
        nome: 'X',
        modalidade: 'completo' as const,
        tagIds: [],
        solicitanteIds: [],
        incluirArquivadas: true,
        validadeDias: undefined,
      };

      for (const linkId of [link.linkId, padrao.linkId]) {
        expect(() =>
          editarLinkCompartilhamento(banco, { ...edicao, linkId }),
        ).toThrow(expect.objectContaining({ codigo: 'link-inexistente' }));
      }
    });
  });

  describe('revogarLinkCompartilhamento', () => {
    it('deve invalidar o acesso imediatamente e liberar o escopo', () => {
      const tagId = exigirIdTag(banco, 'Diretoria');
      const link = criarLinkDeTeste(banco, { tagIds: [tagId] });
      expect(validarTokenCompartilhamento(banco, link.token)).not.toBeNull();

      revogarLinkCompartilhamento(banco, { linkId: link.linkId }, AGORA_TESTE);

      expect(validarTokenCompartilhamento(banco, link.token)).toBeNull();
      expect(contarLinhas(banco, 'escopo_link_tags')).toBe(0);
      expect(excluirTag(banco, { tagId, nomeAtual: 'Diretoria' })).toEqual({
        atividadesAfetadas: 1,
      });
    });

    it('deve bloquear a exclusão da tag enquanto o link restrito existe', () => {
      const tagId = exigirIdTag(banco, 'Diretoria');
      criarLinkDeTeste(banco, { tagIds: [tagId] });

      expect(() =>
        excluirTag(banco, { tagId, nomeAtual: 'Diretoria' }),
      ).toThrow(expect.objectContaining({ codigo: 'tag-em-compartilhamento' }));
    });

    it('deve ser idempotente e manter a data da primeira revogação', () => {
      const link = criarLinkDeTeste(banco, { modalidade: 'completo' });
      revogarLinkCompartilhamento(banco, { linkId: link.linkId }, AGORA_TESTE);

      revogarLinkCompartilhamento(
        banco,
        { linkId: link.linkId },
        new Date('2026-12-01T00:00:00.000Z'),
      );

      const gravado = banco
        .select({ revogadoEm: linksCompartilhamento.revogadoEm })
        .from(linksCompartilhamento)
        .get();
      expect(gravado?.revogadoEm).toBe(AGORA_TESTE.toISOString());
    });

    it('deve responder 404 para link inexistente', () => {
      expect(() =>
        revogarLinkCompartilhamento(banco, { linkId: TAG_INEXISTENTE }),
      ).toThrow(
        expect.objectContaining({ status: 404, codigo: 'link-inexistente' }),
      );
    });
  });

  describe('animal do link', () => {
    it('deve gravar o animal escolhido e levá-lo ao acesso pelo link', () => {
      const { token } = criarLinkDeTeste(banco, {
        nome: 'Carla',
        modalidade: 'completo',
        animal: 'jacare',
      });

      expect(validarTokenCompartilhamento(banco, token, AGORA_TESTE)).toEqual(
        expect.objectContaining({
          nome: 'Carla',
          padrao: false,
          animal: 'jacare',
        }),
      );
    });

    it('deve trocar o animal e voltar a sortear quando vier nulo', () => {
      const { linkId, token } = criarLinkDeTeste(banco, {
        modalidade: 'completo',
      });

      definirAnimalLink(banco, { linkId, animal: 'seriema' });
      const comAnimal = listarLinksCompartilhamento(
        banco,
        exigirBoardId(banco),
      ).find((link) => link.id === linkId);
      definirAnimalLink(banco, { linkId, animal: null });

      expect(comAnimal?.animal).toBe('seriema');
      expect(validarTokenCompartilhamento(banco, token)?.animal).toBeNull();
    });

    it('deve ignorar chave que saiu do catálogo', () => {
      const { linkId, token } = criarLinkDeTeste(banco, {
        modalidade: 'completo',
      });
      banco
        .update(linksCompartilhamento)
        .set({ animal: 'dodo' })
        .where(eq(linksCompartilhamento.id, linkId))
        .run();

      expect(validarTokenCompartilhamento(banco, token)?.animal).toBeNull();
    });

    it('não deve fixar animal no link padrão nem em link revogado', () => {
      const padrao = garantirLinkPadrao(banco, Buffer.alloc(32, 7));
      const { linkId } = criarLinkDeTeste(banco);
      revogarLinkCompartilhamento(banco, { linkId });

      for (const id of [padrao.linkId, linkId]) {
        expect(() =>
          definirAnimalLink(banco, { linkId: id, animal: 'tatu' }),
        ).toThrow(expect.objectContaining({ status: 404 }));
      }
    });
  });
});
