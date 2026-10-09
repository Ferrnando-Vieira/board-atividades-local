import { eq } from 'drizzle-orm';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { anexos } from '@/servidor/banco/esquema';
import { consultarAnexoAutorizado } from '@/servidor/anexos/consultasAnexos';
import {
  buscarAtividades,
  consultarDetalheAtividade,
  listarAtividadesArquivadas,
} from '@/servidor/atividades/consultasAtividades';
import type { RestricaoLeitura } from '@/servidor/atividades/filtrosAtividades';
import { consultarQuadro } from '@/servidor/board/consultaQuadro';
import { validarTokenCompartilhamento } from '@/servidor/compartilhamento/acessoCompartilhamento';
import type { DadosNovoLink } from '@/servidor/compartilhamento/esquemasCompartilhamento';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import { AGORA_TESTE } from '@/tests/suporte/fabricasAtividades';
import {
  criarCenarioEscopo,
  criarLinkDeTeste,
  exigirIdSolicitante,
  exigirIdTag,
  inserirAnexo,
  TITULOS_CENARIO,
  type CenarioEscopo,
} from '@/tests/suporte/fabricasCompartilhamento';

const IDENTIFICADOR_DENTRO = 'arquivo-dentro-do-escopo';
const IDENTIFICADOR_FORA = 'arquivo-fora-do-escopo';
const IDENTIFICADOR_ARQUIVADA = 'arquivo-de-arquivada-x';

describe('leitura com restrição de link', () => {
  let banco: BancoDados;
  let cenario: CenarioEscopo;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cenario = criarCenarioEscopo(banco);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function restricaoDoLink(dados: Partial<DadosNovoLink>): RestricaoLeitura {
    const { token } = criarLinkDeTeste(banco, dados);
    const link = validarTokenCompartilhamento(banco, token, AGORA_TESTE);
    if (!link) {
      throw new Error('Link de teste inválido.');
    }
    return link.restricao;
  }

  function restricaoFaturasFinanceiro(incluirArquivadas = false) {
    return restricaoDoLink({
      tagIds: [exigirIdTag(banco, 'Faturas')],
      solicitanteIds: [exigirIdSolicitante(banco, 'Financeiro')],
      incluirArquivadas,
    });
  }

  describe('quadro', () => {
    it('deve enviar só os cartões do escopo, mantendo as colunas', () => {
      const quadro = consultarQuadro(
        banco,
        AGORA_TESTE,
        restricaoFaturasFinanceiro(),
      );

      const conteudo = JSON.stringify(quadro);
      expect(quadro?.colunas).toHaveLength(4);
      expect(quadro?.colunas[0]?.atividades.map((cartao) => cartao.id)).toEqual(
        [cenario.faturasFinanceiro],
      );
      expect(conteudo).not.toContain(TITULOS_CENARIO.outrosEu);
      expect(conteudo).not.toContain(TITULOS_CENARIO.faturasBugsEu);
      expect(conteudo).not.toContain(TITULOS_CENARIO.semTagsFinanceiro);
      expect(conteudo).not.toContain('Diretoria');
    });

    it('deve incluir cartões sem tags quando o link restringe só por solicitante', () => {
      const quadro = consultarQuadro(
        banco,
        AGORA_TESTE,
        restricaoDoLink({
          solicitanteIds: [exigirIdSolicitante(banco, 'Financeiro')],
        }),
      );

      expect(quadro?.colunas[0]?.atividades.map((cartao) => cartao.id)).toEqual(
        [
          cenario.bugsFinanceiro,
          cenario.faturasFinanceiro,
          cenario.semTagsFinanceiro,
        ],
      );
    });

    it('deve mostrar o board inteiro, inclusive sem tags, no link completo', () => {
      const restricao = restricaoDoLink({
        modalidade: 'completo',
        incluirArquivadas: true,
      });

      const quadro = consultarQuadro(banco, AGORA_TESTE, restricao);

      expect(restricao).toBeNull();
      expect(quadro?.colunas[0]?.atividades).toHaveLength(5);
    });
  });

  describe('detalhe por URL direta', () => {
    it('deve responder como inexistente fora do escopo', () => {
      const restricao = restricaoFaturasFinanceiro();

      expect(
        consultarDetalheAtividade(
          banco,
          cenario.outrosEu,
          AGORA_TESTE,
          restricao,
        ),
      ).toBeNull();
      expect(
        consultarDetalheAtividade(
          banco,
          cenario.faturasBugsEu,
          AGORA_TESTE,
          restricao,
        ),
      ).toBeNull();
    });

    it('deve devolver o detalhe dentro do escopo', () => {
      const consulta = consultarDetalheAtividade(
        banco,
        cenario.faturasFinanceiro,
        AGORA_TESTE,
        restricaoFaturasFinanceiro(),
      );

      expect(consulta?.atividade.titulo).toBe(
        TITULOS_CENARIO.faturasFinanceiro,
      );
    });

    it('não deve abrir arquivada do escopo quando o link exclui arquivadas', () => {
      expect(
        consultarDetalheAtividade(
          banco,
          cenario.arquivadaFaturasFinanceiro,
          AGORA_TESTE,
          restricaoFaturasFinanceiro(false),
        ),
      ).toBeNull();
      expect(
        consultarDetalheAtividade(
          banco,
          cenario.arquivadaFaturasFinanceiro,
          AGORA_TESTE,
          restricaoFaturasFinanceiro(true),
        ),
      ).not.toBeNull();
    });
  });

  describe('arquivadas', () => {
    it('deve ficar vazia quando o link não inclui arquivadas', () => {
      expect(
        listarAtividadesArquivadas(banco, restricaoFaturasFinanceiro(false))
          ?.atividades,
      ).toEqual([]);
    });

    it('deve listar só as arquivadas do escopo quando o link inclui', () => {
      const restricao = restricaoDoLink({
        tagIds: [exigirIdTag(banco, 'Diretoria')],
        incluirArquivadas: true,
      });

      expect(listarAtividadesArquivadas(banco, restricao)?.atividades).toEqual(
        [],
      );
      expect(
        listarAtividadesArquivadas(
          banco,
          restricaoFaturasFinanceiro(true),
        )?.atividades.map((atividade) => atividade.id),
      ).toEqual([cenario.arquivadaFaturasFinanceiro]);
    });
  });

  describe('busca', () => {
    it('não deve encontrar atividade fora do escopo mesmo com termo exato', () => {
      const consulta = buscarAtividades(
        banco,
        'reunião sigilosa diretoria',
        restricaoFaturasFinanceiro(),
      );

      expect(consulta?.resultados).toEqual([]);
    });

    it('deve encontrar dentro do escopo sem diferença de acento', () => {
      const consulta = buscarAtividades(
        banco,
        'FATURAS financeiro',
        restricaoFaturasFinanceiro(),
      );

      expect(consulta?.resultados.map((resultado) => resultado.id)).toEqual([
        cenario.faturasFinanceiro,
      ]);
    });

    it('deve buscar também na descrição, nas tags e no solicitante sem restrição', () => {
      const consulta = buscarAtividades(banco, 'descrição diretoria');

      expect(consulta?.resultados.map((resultado) => resultado.id)).toEqual([
        cenario.outrosEu,
      ]);
    });
  });

  describe('anexos', () => {
    let anexoDentroId: number;
    let anexoForaId: number;
    let anexoArquivadaId: number;

    beforeEach(() => {
      anexoDentroId = inserirAnexo(
        banco,
        cenario.faturasFinanceiro,
        IDENTIFICADOR_DENTRO,
      );
      anexoForaId = inserirAnexo(banco, cenario.outrosEu, IDENTIFICADOR_FORA);
      anexoArquivadaId = inserirAnexo(
        banco,
        cenario.arquivadaFaturasFinanceiro,
        IDENTIFICADOR_ARQUIVADA,
      );
    });

    it('deve liberar o anexo de atividade do escopo', () => {
      expect(
        consultarAnexoAutorizado(
          banco,
          anexoDentroId,
          restricaoFaturasFinanceiro(),
        )?.identificadorArquivo,
      ).toBe(IDENTIFICADOR_DENTRO);
    });

    it('não deve liberar anexo de atividade fora do escopo', () => {
      expect(
        consultarAnexoAutorizado(
          banco,
          anexoForaId,
          restricaoFaturasFinanceiro(),
        ),
      ).toBeNull();
    });

    it('não deve liberar anexo de arquivada quando o link exclui arquivadas', () => {
      expect(
        consultarAnexoAutorizado(
          banco,
          anexoArquivadaId,
          restricaoFaturasFinanceiro(false),
        ),
      ).toBeNull();
    });

    it('não deve liberar anexo removido nem listá-lo no detalhe', () => {
      banco
        .update(anexos)
        .set({ removidoEm: AGORA_TESTE.toISOString() })
        .where(eq(anexos.id, anexoDentroId))
        .run();

      const detalhe = consultarDetalheAtividade(
        banco,
        cenario.faturasFinanceiro,
        AGORA_TESTE,
        restricaoFaturasFinanceiro(),
      );

      expect(consultarAnexoAutorizado(banco, anexoDentroId, null)).toBeNull();
      expect(detalhe?.atividade.anexos).toEqual([]);
    });

    it('deve listar no detalhe só os anexos da própria atividade', () => {
      const detalhe = consultarDetalheAtividade(
        banco,
        cenario.faturasFinanceiro,
        AGORA_TESTE,
        restricaoFaturasFinanceiro(),
      );

      expect(detalhe?.atividade.anexos.map((anexo) => anexo.id)).toEqual([
        anexoDentroId,
      ]);
      expect(JSON.stringify(detalhe)).not.toContain(IDENTIFICADOR_DENTRO);
    });
  });
});
