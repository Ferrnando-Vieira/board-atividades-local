import { eq } from 'drizzle-orm';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { atividades } from '@/servidor/banco/esquema';
import {
  arquivarAtividade,
  criarAtividade,
  editarAtividade,
} from '@/servidor/atividades/atividadesServico';
import {
  consultarDetalheAtividade,
  consultarOpcoesFormularioAtividade,
  listarAtividadesArquivadas,
} from '@/servidor/atividades/consultasAtividades';
import {
  consultarQuadro,
  listarStatusGerenciaveis,
} from '@/servidor/board/consultaQuadro';
import { listarTagsGerenciaveis } from '@/servidor/classificacao/consultasClassificacao';
import {
  criarBancoInicializado,
  SOLICITANTE_PADRAO_TESTE,
} from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  criarAtividadesNoStatus,
  exigirBoardId,
  exigirStatusPorChave,
  montarDadosAtividade,
  MOMENTO_LOCAL_TESTE,
} from '@/tests/suporte/fabricasAtividades';

const VERSAO_INICIAL = 1;
const ATIVIDADE_INEXISTENTE = 9999;
const FORMATO_INSTANTE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const NOMES_STATUS_INICIAIS = [
  'A Fazer',
  'Em Andamento',
  'Bloqueados',
  'Concluídos',
];

describe('consultas de leitura', () => {
  let banco: BancoDados;
  let aFazerId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('consultarQuadro', () => {
    it('deve devolver as colunas na ordem do board com os cartões completos', () => {
      const { atividadeId } = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, {
          titulo: 'Conferir fretes',
          prioridade: 2,
          solicitante: 'Financeiro',
          tags: ['Zeta', 'alfa'],
          prazoData: '2026-10-05',
          prazoHora: '18:00',
        }),
        AGORA_TESTE,
      );

      const quadro = consultarQuadro(banco, AGORA_TESTE);

      expect(quadro?.momentoLocal).toEqual(MOMENTO_LOCAL_TESTE);
      expect(quadro?.colunas.map((coluna) => coluna.nome)).toEqual(
        NOMES_STATUS_INICIAIS,
      );
      expect(quadro?.colunas[0]?.atividades).toEqual([
        {
          id: atividadeId,
          titulo: 'Conferir fretes',
          prioridade: 2,
          versao: VERSAO_INICIAL,
          criadoEm: expect.stringMatching(FORMATO_INSTANTE_ISO),
          solicitanteId: expect.any(Number),
          solicitante: 'Financeiro',
          tags: [
            expect.objectContaining({ nome: 'alfa' }),
            expect.objectContaining({ nome: 'Zeta' }),
          ],
          prazoData: '2026-10-05',
          prazoHora: '18:00',
          concluidaEmData: null,
          concluidaEmHora: null,
        },
      ]);
    });

    it('não deve exibir atividades arquivadas', () => {
      const [arquivadaId = 0, ativaId = 0] = criarAtividadesNoStatus(
        banco,
        aFazerId,
        ['Arquivada', 'Ativa'],
      );
      arquivarAtividade(
        banco,
        { atividadeId: arquivadaId, versaoEsperada: VERSAO_INICIAL },
        AGORA_TESTE,
      );

      const quadro = consultarQuadro(banco, AGORA_TESTE);

      expect(quadro?.colunas[0]?.atividades.map((cartao) => cartao.id)).toEqual(
        [ativaId],
      );
    });
  });

  describe('consultarDetalheAtividade', () => {
    it('deve devolver todos os campos do modelo, inclusive o lembrete', () => {
      const { atividadeId } = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, {
          descricao: 'Texto longo',
          tags: ['Infra'],
        }),
        AGORA_TESTE,
      );
      banco
        .update(atividades)
        .set({
          lembreteEm: '2026-09-30T16:45:00.000Z',
          lembreteSituacao: 'disparado',
        })
        .where(eq(atividades.id, atividadeId))
        .run();

      const consulta = consultarDetalheAtividade(
        banco,
        atividadeId,
        AGORA_TESTE,
      );

      expect(consulta?.atividade).toEqual(
        expect.objectContaining({
          descricao: 'Texto longo',
          status: expect.objectContaining({ nome: 'A Fazer' }),
          solicitante: SOLICITANTE_PADRAO_TESTE,
          tags: [expect.objectContaining({ nome: 'Infra' })],
          lembreteSituacao: 'disparado',
          arquivadaEm: null,
        }),
      );
    });

    it('deve devolver null para atividade inexistente', () => {
      expect(
        consultarDetalheAtividade(banco, ATIVIDADE_INEXISTENTE, AGORA_TESTE),
      ).toBeNull();
    });
  });

  describe('listarAtividadesArquivadas', () => {
    it('deve listar só as arquivadas, da mais recente para a mais antiga', () => {
      const [primeiraId = 0, segundaId = 0] = criarAtividadesNoStatus(
        banco,
        aFazerId,
        ['Primeira', 'Segunda', 'Ativa'],
      );
      arquivarAtividade(
        banco,
        { atividadeId: primeiraId, versaoEsperada: VERSAO_INICIAL },
        new Date('2026-10-01T10:00:00.000Z'),
      );
      arquivarAtividade(
        banco,
        { atividadeId: segundaId, versaoEsperada: VERSAO_INICIAL },
        new Date('2026-10-01T11:00:00.000Z'),
      );

      const consulta = listarAtividadesArquivadas(banco);

      expect(consulta?.atividades.map((atividade) => atividade.id)).toEqual([
        segundaId,
        primeiraId,
      ]);
      expect(consulta?.atividades[0]?.statusNome).toBe('A Fazer');
    });
  });

  describe('consultarOpcoesFormularioAtividade', () => {
    it('deve sugerir só solicitantes em uso e sempre o padrão', () => {
      const { atividadeId } = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { solicitante: 'Digitado errado' }),
        AGORA_TESTE,
      );
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, { solicitante: 'Financeiro' }),
          atividadeId,
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );
      criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { solicitante: 'financeiro' }),
        AGORA_TESTE,
      );

      const opcoes = consultarOpcoesFormularioAtividade(banco);

      expect(opcoes?.solicitantes).toEqual([
        'Financeiro',
        SOLICITANTE_PADRAO_TESTE,
      ]);
      expect(opcoes?.solicitantePadrao).toBe(SOLICITANTE_PADRAO_TESTE);
      expect(opcoes?.status.map((status) => status.nome)).toEqual(
        NOMES_STATUS_INICIAIS,
      );
    });
  });

  describe('listagens de gestão', () => {
    it('deve contar atividades ativas e arquivadas por status', () => {
      const [arquivadaId = 0] = criarAtividadesNoStatus(banco, aFazerId, [
        'Arquivada',
        'Ativa 1',
        'Ativa 2',
      ]);
      arquivarAtividade(
        banco,
        { atividadeId: arquivadaId, versaoEsperada: VERSAO_INICIAL },
        AGORA_TESTE,
      );

      const status = listarStatusGerenciaveis(banco, exigirBoardId(banco));

      expect(status[0]).toEqual(
        expect.objectContaining({
          nome: 'A Fazer',
          quantidadeAtivas: 2,
          quantidadeArquivadas: 1,
        }),
      );
      expect(status[1]).toEqual(
        expect.objectContaining({
          quantidadeAtivas: 0,
          quantidadeArquivadas: 0,
        }),
      );
    });

    it('deve listar tags em ordem alfabética com a quantidade de atividades', () => {
      criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { tags: ['bugs', 'Ágil'] }),
        AGORA_TESTE,
      );
      criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { tags: ['Bugs'] }),
        AGORA_TESTE,
      );

      const tags = listarTagsGerenciaveis(banco, exigirBoardId(banco));

      expect(tags).toEqual([
        expect.objectContaining({ nome: 'Ágil', quantidadeAtividades: 1 }),
        expect.objectContaining({ nome: 'bugs', quantidadeAtividades: 2 }),
      ]);
    });
  });
});
