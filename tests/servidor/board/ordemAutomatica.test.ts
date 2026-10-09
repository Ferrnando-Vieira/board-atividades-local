import { eq } from 'drizzle-orm';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { atividades } from '@/servidor/banco/esquema';
import { calcularPosicoes } from '@/servidor/api/mapeadoresApi';
import {
  criarAtividade,
  editarAtividade,
  moverAtividadeParaPosicao,
} from '@/servidor/atividades/atividadesServico';
import { consultarQuadro } from '@/servidor/board/consultaQuadro';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  buscarAtividadeGravada,
  exigirBoardId,
  exigirStatusPorChave,
  montarDadosAtividade,
} from '@/tests/suporte/fabricasAtividades';
import { ordenarNaColuna } from '@/util/OrdenacaoAtividadesUtils';

const VERSAO_INICIAL = 1;
const PRIORIDADE_CRITICA = 0;
const PRIORIDADE_PADRAO = 5;
const PRIORIDADE_BAIXA = 9;
const CRIACAO_ANTIGA = '2026-09-01T09:00:00.000Z';
const CRIACAO_MEDIA = '2026-09-10T09:00:00.000Z';
const CRIACAO_RECENTE = '2026-09-20T09:00:00.000Z';

describe('ordem automática dos cartões', () => {
  let banco: BancoDados;
  let aFazerId: number;
  let emAndamentoId: number;

  function criar(titulo: string, prioridade: number, criadoEm: string): number {
    const { atividadeId } = criarAtividade(
      banco,
      montarDadosAtividade(aFazerId, { titulo, prioridade }),
      AGORA_TESTE,
    );
    banco
      .update(atividades)
      .set({ criadoEm })
      .where(eq(atividades.id, atividadeId))
      .run();
    return atividadeId;
  }

  function idsDaColuna(statusId: number): number[] {
    return (
      consultarQuadro(banco, AGORA_TESTE)
        ?.colunas.find((coluna) => coluna.id === statusId)
        ?.atividades.map((cartao) => cartao.id) ?? []
    );
  }

  beforeEach(() => {
    banco = criarBancoInicializado();
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    emAndamentoId = exigirStatusPorChave(banco, 'em-andamento').id;
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  it('deve ordenar por prioridade e, no empate, pela abertura mais antiga', () => {
    const recentePadrao = criar('Recente', PRIORIDADE_PADRAO, CRIACAO_RECENTE);
    const baixa = criar('Baixa', PRIORIDADE_BAIXA, CRIACAO_ANTIGA);
    const antigaPadrao = criar('Antiga', PRIORIDADE_PADRAO, CRIACAO_ANTIGA);
    const critica = criar('Crítica', PRIORIDADE_CRITICA, CRIACAO_RECENTE);

    expect(idsDaColuna(aFazerId)).toEqual([
      critica,
      antigaPadrao,
      recentePadrao,
      baixa,
    ]);
  });

  it('deve desempatar pelo identificador quando prioridade e abertura coincidem', () => {
    const primeira = criar('Primeira', PRIORIDADE_PADRAO, CRIACAO_MEDIA);
    const segunda = criar('Segunda', PRIORIDADE_PADRAO, CRIACAO_MEDIA);

    expect(idsDaColuna(aFazerId)).toEqual([primeira, segunda]);
  });

  it('deve produzir no servidor a mesma ordem do comparador do navegador', () => {
    criar('A', PRIORIDADE_BAIXA, CRIACAO_RECENTE);
    criar('B', PRIORIDADE_PADRAO, CRIACAO_MEDIA);
    criar('C', PRIORIDADE_PADRAO, CRIACAO_ANTIGA);
    criar('D', PRIORIDADE_CRITICA, CRIACAO_MEDIA);

    const cartoes =
      consultarQuadro(banco, AGORA_TESTE)?.colunas.find(
        (coluna) => coluna.id === aFazerId,
      )?.atividades ?? [];

    expect(cartoes).toEqual(ordenarNaColuna(cartoes, false));
  });

  it('deve reposicionar ao mudar a prioridade, preservando a data de abertura', () => {
    const primeira = criar('Primeira', PRIORIDADE_PADRAO, CRIACAO_ANTIGA);
    const segunda = criar('Segunda', PRIORIDADE_PADRAO, CRIACAO_RECENTE);

    editarAtividade(
      banco,
      {
        ...montarDadosAtividade(aFazerId, {
          titulo: 'Segunda',
          prioridade: PRIORIDADE_CRITICA,
        }),
        atividadeId: segunda,
        versaoEsperada: VERSAO_INICIAL,
      },
      AGORA_TESTE,
    );

    expect(idsDaColuna(aFazerId)).toEqual([segunda, primeira]);
    expect(buscarAtividadeGravada(banco, segunda).criadoEm).toBe(
      CRIACAO_RECENTE,
    );
  });

  it('deve ignorar a posição pedida ao mover e usar a ordem automática do destino', () => {
    const antiga = criar('Antiga', PRIORIDADE_PADRAO, CRIACAO_ANTIGA);
    const recente = criar('Recente', PRIORIDADE_PADRAO, CRIACAO_RECENTE);
    moverAtividadeParaPosicao(banco, {
      atividadeId: antiga,
      versaoEsperada: VERSAO_INICIAL,
      statusDestinoId: emAndamentoId,
      posicao: null,
    });

    moverAtividadeParaPosicao(banco, {
      atividadeId: recente,
      versaoEsperada: VERSAO_INICIAL,
      statusDestinoId: emAndamentoId,
      posicao: 0,
    });

    expect(idsDaColuna(emAndamentoId)).toEqual([antiga, recente]);
  });

  it('deve informar à API a mesma posição que o quadro exibe', () => {
    const baixa = criar('Baixa', PRIORIDADE_BAIXA, CRIACAO_ANTIGA);
    const critica = criar('Crítica', PRIORIDADE_CRITICA, CRIACAO_RECENTE);

    const posicoes = calcularPosicoes(banco, exigirBoardId(banco));

    expect(posicoes.get(critica)).toBe(0);
    expect(posicoes.get(baixa)).toBe(1);
  });

  it('deve ordenar a coluna que finaliza pela conclusão mais recente', () => {
    const concluidosId = exigirStatusPorChave(banco, 'concluidos').id;
    const antiga = criar('Antiga', PRIORIDADE_CRITICA, CRIACAO_ANTIGA);
    const recente = criar('Recente', PRIORIDADE_BAIXA, CRIACAO_RECENTE);
    const media = criar('Média', PRIORIDADE_PADRAO, CRIACAO_MEDIA);
    const conclusoes = [
      [antiga, '2026-09-25', '08:00'],
      [recente, '2026-09-30', '09:00'],
      [media, '2026-09-30', '17:00'],
    ] as const;
    for (const [id, concluidaEmData, concluidaEmHora] of conclusoes) {
      moverAtividadeParaPosicao(banco, {
        atividadeId: id,
        versaoEsperada: VERSAO_INICIAL,
        statusDestinoId: concluidosId,
        posicao: null,
      });
      banco
        .update(atividades)
        .set({ concluidaEmData, concluidaEmHora })
        .where(eq(atividades.id, id))
        .run();
    }

    expect(idsDaColuna(concluidosId)).toEqual([media, recente, antiga]);
    const posicoes = calcularPosicoes(banco, exigirBoardId(banco));
    expect(posicoes.get(media)).toBe(0);
    expect(posicoes.get(antiga)).toBe(2);
  });
});
