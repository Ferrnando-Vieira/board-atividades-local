import { eq } from 'drizzle-orm';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { solicitantes } from '@/servidor/banco/esquema';
import {
  criarAtividade,
  editarAtividade,
} from '@/servidor/atividades/atividadesServico';
import { consultarDetalheAtividade } from '@/servidor/atividades/consultasAtividades';
import { CODIGO_SOLICITANTE_OBRIGATORIO } from '@/servidor/classificacao/classificacaoRepositorio';
import {
  listarTagsGerenciaveis,
  mapearSolicitantesPadraoTags,
} from '@/servidor/classificacao/consultasClassificacao';
import { esquemaEdicaoTag } from '@/servidor/classificacao/esquemasTags';
import { criarTag, editarTag } from '@/servidor/classificacao/tagsServico';
import {
  contarLinhas,
  criarBancoInicializado,
  SOLICITANTE_PADRAO_TESTE,
} from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  exigirBoardId,
  exigirStatusPorChave,
  montarDadosAtividade,
} from '@/tests/suporte/fabricasAtividades';

const VERSAO_INICIAL = 1;

// Nomes fictícios: nenhuma tag nem regra vem do código; o teste cadastra as
// suas como faria o usuário na tela de Tags.
describe('solicitante padrão por tag', () => {
  let banco: BancoDados;
  let aFazerId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    criarTag(banco, { nome: 'Infra', solicitantePadrao: 'Bruno Infra' });
    criarTag(banco, { nome: 'Portal', solicitantePadrao: 'Carla Portal' });
    criarTag(banco, { nome: 'Sem dono' });
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function exigirTag(nome: string) {
    const tag = listarTagsGerenciaveis(banco, exigirBoardId(banco)).find(
      (item) => item.nome === nome,
    );
    if (!tag) {
      throw new Error(`Tag ${nome} ausente.`);
    }
    return tag;
  }

  function solicitanteDe(atividadeId: number): string | undefined {
    return consultarDetalheAtividade(banco, atividadeId, AGORA_TESTE)?.atividade
      .solicitante;
  }

  function criarSemSolicitante(tagsDaAtividade: string[]): number {
    return criarAtividade(
      banco,
      montarDadosAtividade(aFazerId, {
        solicitante: null,
        tags: tagsDaAtividade,
      }),
      AGORA_TESTE,
    ).atividadeId;
  }

  describe('cadastro na tag', () => {
    it('deve gravar e listar o solicitante padrão, cadastrando o nome novo', () => {
      expect(exigirTag('Infra').solicitantePadrao).toBe('Bruno Infra');
      expect(exigirTag('Sem dono').solicitantePadrao).toBeNull();
      expect(
        banco
          .select({ nome: solicitantes.nome })
          .from(solicitantes)
          .where(eq(solicitantes.nome, 'Bruno Infra'))
          .get(),
      ).toEqual({ nome: 'Bruno Infra' });
    });

    it('deve trocar, manter quando omitido e remover com nulo ou em branco', () => {
      const tag = exigirTag('Infra');
      const base = { tagId: tag.id, nomeAtual: 'Infra', nome: 'Infra' };

      editarTag(banco, { ...base, solicitantePadrao: 'Carla Portal' });
      expect(exigirTag('Infra').solicitantePadrao).toBe('Carla Portal');

      editarTag(banco, { ...base, cor: '#bfdbfe' });
      expect(exigirTag('Infra').solicitantePadrao).toBe('Carla Portal');

      editarTag(
        banco,
        esquemaEdicaoTag.parse({ ...base, solicitantePadrao: '   ' }),
      );
      expect(exigirTag('Infra').solicitantePadrao).toBeNull();
    });

    it('deve mapear o padrão pela chave normalizada do nome da tag', () => {
      expect(mapearSolicitantesPadraoTags(banco, exigirBoardId(banco))).toEqual(
        { infra: 'Bruno Infra', portal: 'Carla Portal' },
      );
    });

    it('deve desfazer o vínculo se o solicitante deixar de existir', () => {
      const tag = exigirTag('Sem dono');
      banco.$client
        .prepare(
          "INSERT INTO solicitantes (board_id, nome, nome_normalizado) VALUES (?, 'Temporario', 'temporario')",
        )
        .run(exigirBoardId(banco));
      editarTag(banco, {
        tagId: tag.id,
        nomeAtual: 'Sem dono',
        nome: 'Sem dono',
        solicitantePadrao: 'Temporario',
      });

      banco.$client
        .prepare("DELETE FROM solicitantes WHERE nome = 'Temporario'")
        .run();

      expect(exigirTag('Sem dono').solicitantePadrao).toBeNull();
    });
  });

  describe('atividade salva sem solicitante', () => {
    it('deve usar o padrão da primeira tag, na ordem em que foram adicionadas', () => {
      expect(solicitanteDe(criarSemSolicitante(['Portal', 'Infra']))).toBe(
        'Carla Portal',
      );
      expect(solicitanteDe(criarSemSolicitante(['Infra', 'Portal']))).toBe(
        'Bruno Infra',
      );
    });

    it('deve pular tags sem padrão e ignorar caixa e acento', () => {
      expect(solicitanteDe(criarSemSolicitante(['Sem dono', 'pórtal']))).toBe(
        'Carla Portal',
      );
    });

    it('deve cair no padrão do board sem tags com padrão', () => {
      expect(solicitanteDe(criarSemSolicitante(['Sem dono', 'Nova']))).toBe(
        SOLICITANTE_PADRAO_TESTE,
      );
      expect(solicitanteDe(criarSemSolicitante([]))).toBe(
        SOLICITANTE_PADRAO_TESTE,
      );
    });

    it('deve respeitar o solicitante informado', () => {
      const { atividadeId } = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, {
          solicitante: 'Financeiro',
          tags: ['Infra'],
        }),
        AGORA_TESTE,
      );

      expect(solicitanteDe(atividadeId)).toBe('Financeiro');
    });

    it('deve usar o padrão da tag mesmo sem padrão no board', () => {
      banco.$client.prepare('UPDATE solicitantes SET padrao = 0').run();

      expect(solicitanteDe(criarSemSolicitante(['Infra']))).toBe('Bruno Infra');
      expect(() => criarSemSolicitante(['Sem dono'])).toThrow(
        expect.objectContaining({ codigo: CODIGO_SOLICITANTE_OBRIGATORIO }),
      );
    });

    it('na edição, deve valer a tag vinculada primeiro, não a ordem do formulário', () => {
      const atividadeId = criarSemSolicitante(['Portal', 'Infra']);

      // O formulário de edição lista as tags em ordem alfabética.
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, {
            solicitante: null,
            tags: ['Infra', 'Portal'],
          }),
          atividadeId,
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );

      expect(solicitanteDe(atividadeId)).toBe('Carla Portal');
    });

    it('na edição, as tags novas entram depois das já vinculadas', () => {
      const atividadeId = criarSemSolicitante(['Sem dono']);
      expect(solicitanteDe(atividadeId)).toBe(SOLICITANTE_PADRAO_TESTE);

      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, {
            solicitante: null,
            tags: ['Portal', 'Sem dono', 'Infra'],
          }),
          atividadeId,
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );

      expect(solicitanteDe(atividadeId)).toBe('Carla Portal');
    });

    it('não deve alterar atividades já gravadas ao mudar o padrão da tag', () => {
      const atividadeId = criarSemSolicitante(['Infra']);
      const tag = exigirTag('Infra');

      editarTag(banco, {
        tagId: tag.id,
        nomeAtual: 'Infra',
        nome: 'Infra',
        solicitantePadrao: 'Outra Pessoa',
      });

      expect(solicitanteDe(atividadeId)).toBe('Bruno Infra');
      expect(contarLinhas(banco, 'atividades')).toBe(1);
    });
  });
});
