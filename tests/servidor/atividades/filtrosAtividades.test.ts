import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { listarAtividadesDetalhadas } from '@/servidor/atividades/consultasAtividades';
import {
  criarFiltroAtividades,
  FILTRO_ABERTO,
  type FiltroAtividades,
} from '@/servidor/atividades/filtrosAtividades';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import { exigirStatusPorChave } from '@/tests/suporte/fabricasAtividades';
import {
  criarCenarioEscopo,
  exigirIdSolicitante,
  exigirIdTag,
  type CenarioEscopo,
} from '@/tests/suporte/fabricasCompartilhamento';

describe('filtro de atividades', () => {
  let banco: BancoDados;
  let cenario: CenarioEscopo;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cenario = criarCenarioEscopo(banco);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function listarIds(filtro: FiltroAtividades | null): number[] {
    return listarAtividadesDetalhadas(banco, filtro, null)
      .map((atividade) => atividade.id)
      .sort((primeiro, segundo) => primeiro - segundo);
  }

  function ordenar(ids: number[]): number[] {
    return [...ids].sort((primeiro, segundo) => primeiro - segundo);
  }

  it('deve combinar as tags com OU', () => {
    const filtro = criarFiltroAtividades({
      tagIds: [exigirIdTag(banco, 'Faturas'), exigirIdTag(banco, 'Bugs')],
      arquivamento: 'ativas',
    });

    expect(listarIds(filtro)).toEqual(
      ordenar([
        cenario.faturasFinanceiro,
        cenario.faturasBugsEu,
        cenario.bugsFinanceiro,
      ]),
    );
  });

  it('deve combinar os solicitantes com OU', () => {
    const filtro = criarFiltroAtividades({
      solicitanteIds: [
        exigirIdSolicitante(banco, 'Financeiro'),
        exigirIdSolicitante(banco, 'Eu'),
      ],
      arquivamento: 'ativas',
    });

    expect(listarIds(filtro)).toHaveLength(5);
  });

  it('deve combinar tags e solicitantes com E', () => {
    const filtro = criarFiltroAtividades({
      tagIds: [exigirIdTag(banco, 'Faturas')],
      solicitanteIds: [exigirIdSolicitante(banco, 'Financeiro')],
      arquivamento: 'ativas',
    });

    expect(listarIds(filtro)).toEqual([cenario.faturasFinanceiro]);
  });

  it('deve tratar grupo vazio como sem filtro, inclusive para atividades sem tags', () => {
    const filtro = criarFiltroAtividades({
      solicitanteIds: [exigirIdSolicitante(banco, 'Financeiro')],
      arquivamento: 'ativas',
    });

    expect(listarIds(filtro)).toEqual(
      ordenar([
        cenario.faturasFinanceiro,
        cenario.bugsFinanceiro,
        cenario.semTagsFinanceiro,
      ]),
    );
  });

  it('deve separar ativas, arquivadas e todas', () => {
    const tagFaturas = [exigirIdTag(banco, 'Faturas')];

    const ativas = listarIds(
      criarFiltroAtividades({ tagIds: tagFaturas, arquivamento: 'ativas' }),
    );
    const arquivadas = listarIds(
      criarFiltroAtividades({ tagIds: tagFaturas, arquivamento: 'arquivadas' }),
    );
    const todas = listarIds(
      criarFiltroAtividades({ tagIds: tagFaturas, arquivamento: 'todas' }),
    );

    expect(ativas).not.toContain(cenario.arquivadaFaturasFinanceiro);
    expect(arquivadas).toEqual([cenario.arquivadaFaturasFinanceiro]);
    expect(todas).toEqual(ordenar([...ativas, ...arquivadas]));
  });

  it('deve filtrar por status e por faixa de prioridade', () => {
    const aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    const emAndamentoId = exigirStatusPorChave(banco, 'em-andamento').id;

    const noAFazer = listarIds(
      criarFiltroAtividades({ statusIds: [aFazerId] }),
    );
    const emAndamento = listarIds(
      criarFiltroAtividades({ statusIds: [emAndamentoId] }),
    );
    const prioridadeAlta = listarIds(
      criarFiltroAtividades({ prioridadeMinima: 0, prioridadeMaxima: 4 }),
    );
    const prioridadePadrao = listarIds(
      criarFiltroAtividades({ prioridadeMinima: 5, prioridadeMaxima: 5 }),
    );

    expect(noAFazer).toHaveLength(6);
    expect(emAndamento).toEqual([]);
    expect(prioridadeAlta).toEqual([]);
    expect(prioridadePadrao).toHaveLength(6);
  });

  it('deve devolver tudo com filtro aberto ou nulo', () => {
    expect(listarIds(FILTRO_ABERTO)).toHaveLength(6);
    expect(listarIds(null)).toHaveLength(6);
  });

  it('deve aplicar filtro e restrição juntos, sem que o filtro amplie a restrição', () => {
    const restricao = criarFiltroAtividades({
      solicitanteIds: [exigirIdSolicitante(banco, 'Eu')],
      arquivamento: 'ativas',
    });
    const filtroAmplo = criarFiltroAtividades({
      tagIds: [exigirIdTag(banco, 'Faturas'), exigirIdTag(banco, 'Bugs')],
    });

    const ids = listarAtividadesDetalhadas(
      banco,
      filtroAmplo,
      null,
      restricao,
    ).map((atividade) => atividade.id);

    expect(ids).toEqual([cenario.faturasBugsEu]);
  });
});
