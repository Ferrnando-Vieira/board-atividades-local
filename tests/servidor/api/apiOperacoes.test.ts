jest.mock('@/servidor/web/bancoAplicacao', () => ({
  CODIGO_BANCO_AUSENTE: 'banco-ausente',
  obterBancoAplicacao: jest.fn(),
}));

import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  esquemaAtividadeApi,
  esquemaBoardApi,
  esquemaListaAtividadesApi,
  esquemaListaStatusApi,
  type AtividadeApi,
} from '@/servidor/api/esquemasApi';
import { listarIdsAtivosDoStatus } from '@/servidor/atividades/atividadesRepositorio';
import {
  editarAtividade,
  moverAtividade,
} from '@/servidor/atividades/atividadesServico';
import {
  consultarDetalheAtividade,
  listarAtividadesArquivadas,
} from '@/servidor/atividades/consultasAtividades';
import { listarStatusDoBoard } from '@/servidor/board/boardRepositorio';
import { consultarQuadro } from '@/servidor/board/consultaQuadro';
import { consultarHistoricoAtividade } from '@/servidor/historico/consultasHistorico';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  contarLinhas,
  criarBancoInicializado,
  SOLICITANTE_PADRAO_TESTE,
} from '@/tests/suporte/bancoTeste';
import { chamarApi, MODULOS_ROTA_API } from '@/tests/suporte/clienteApi';
import {
  AGORA_TESTE,
  buscarAtividadeGravada,
  exigirBoardId,
  exigirStatusPorChave,
  montarDadosAtividade,
} from '@/tests/suporte/fabricasAtividades';
import {
  cadastrarAdministrador,
  criarCenarioEscopo,
  criarLinkDeTeste,
  criarTokenApiDeTeste,
  exigirIdTag,
  TITULOS_CENARIO,
  type CenarioEscopo,
} from '@/tests/suporte/fabricasCompartilhamento';

function exigirRota(caminho: string) {
  const modulo = MODULOS_ROTA_API[caminho];
  if (!modulo) {
    throw new Error(`Rota ${caminho} ausente no mapa de teste.`);
  }
  return modulo;
}

// Ordem que a interface exibe (automática), não a coluna interna `ordem`.
function consultarIdsDaColunaNoQuadro(
  banco: BancoDados,
  statusId: number,
): number[] {
  return (
    consultarQuadro(banco, AGORA_TESTE)
      ?.colunas.find((coluna) => coluna.id === statusId)
      ?.atividades.map((cartao) => cartao.id) ?? []
  );
}

const ATIVIDADES = exigirRota('/api/v1/atividades');
const ATIVIDADE = exigirRota('/api/v1/atividades/{id}');
const MOVER_ATIVIDADE = exigirRota('/api/v1/atividades/{id}/mover');
const ARQUIVAR = exigirRota('/api/v1/atividades/{id}/arquivar');
const DESARQUIVAR = exigirRota('/api/v1/atividades/{id}/desarquivar');
const BOARD = exigirRota('/api/v1/board');
const STATUS = exigirRota('/api/v1/status');
const UM_STATUS = exigirRota('/api/v1/status/{id}');
const MOVER_STATUS = exigirRota('/api/v1/status/{id}/mover');
const TAGS = exigirRota('/api/v1/tags');
const UMA_TAG = exigirRota('/api/v1/tags/{id}');
const SOLICITANTES = exigirRota('/api/v1/solicitantes');

const PRIORIDADE_URGENTE = 0;
const PRIORIDADE_PADRAO = 5;
const ATIVIDADE_INEXISTENTE = '99999';

describe('API: operações sobre o mesmo domínio da interface', () => {
  let banco: BancoDados;
  let cenario: CenarioEscopo;
  let token: string;
  let aFazerId: number;
  let emAndamentoId: number;
  let concluidosId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    cenario = criarCenarioEscopo(banco);
    token = criarTokenApiDeTeste(banco, [
      'board:ler',
      'board:escrever',
      'atividades:ler',
      'atividades:escrever',
    ]);
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    emAndamentoId = exigirStatusPorChave(banco, 'em-andamento').id;
    concluidosId = exigirStatusPorChave(banco, 'concluidos').id;
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function lerAtividade(dados: unknown): AtividadeApi {
    return esquemaAtividadeApi.parse(dados);
  }

  function lerLista(dados: unknown): AtividadeApi[] {
    return esquemaListaAtividadesApi.parse(dados);
  }

  async function listarTitulos(consulta: string): Promise<string[]> {
    const resposta = await chamarApi(ATIVIDADES, 'GET', { token, consulta });
    expect(resposta.status).toBe(200);
    return lerLista(resposta.corpo.dados).map((atividade) => atividade.titulo);
  }

  describe('leitura', () => {
    it('deve devolver o board com status em ordem e totais', async () => {
      const resposta = await chamarApi(BOARD, 'GET', { token });

      const board = esquemaBoardApi.parse(resposta.corpo.dados);
      expect(
        board.status.map((status) => [status.nome, status.posicao]),
      ).toEqual([
        ['A Fazer', 0],
        ['Em Andamento', 1],
        ['Bloqueados', 2],
        ['Concluídos', 3],
      ]);
      expect(board.totais).toEqual({ ativas: 5, arquivadas: 1 });
    });

    it('deve listar ativas na ordem do quadro, com posição', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'GET', { token });

      const atividades = lerLista(resposta.corpo.dados);
      expect(atividades.map((atividade) => atividade.posicao)).toEqual([
        0, 1, 2, 3, 4,
      ]);
      expect(atividades.every((atividade) => !atividade.arquivada)).toBe(true);
    });

    it('deve filtrar com OU dentro de tags e de solicitantes e E entre eles', async () => {
      const ouTags = await listarTitulos('?tag=Faturas&tag=bugs');
      const ouSolicitantes = await listarTitulos(
        '?solicitante=financeiro&solicitante=Diretoria',
      );
      const eEntreGrupos = await listarTitulos(
        '?tag=Faturas&solicitante=Financeiro',
      );

      expect(ouTags).toEqual([
        TITULOS_CENARIO.bugsFinanceiro,
        TITULOS_CENARIO.faturasFinanceiro,
        TITULOS_CENARIO.faturasBugsEu,
      ]);
      expect(ouSolicitantes).toHaveLength(3);
      expect(eEntreGrupos).toEqual([TITULOS_CENARIO.faturasFinanceiro]);
    });

    it('deve devolver lista vazia para tag inexistente, sem cair em "sem filtro"', async () => {
      expect(await listarTitulos('?tag=Inexistente')).toEqual([]);
    });

    it('deve separar ativas, arquivadas e todas', async () => {
      expect(await listarTitulos('?situacao=arquivadas')).toEqual([
        TITULOS_CENARIO.arquivadaFaturasFinanceiro,
      ]);
      expect(await listarTitulos('?situacao=todas')).toHaveLength(6);
    });

    it('deve buscar sem diferença de acento e filtrar por status', async () => {
      expect(await listarTitulos('?busca=REUNIAO%20sigilosa')).toEqual([
        TITULOS_CENARIO.outrosEu,
      ]);
      expect(await listarTitulos(`?status=${emAndamentoId}`)).toEqual([]);
    });

    it('deve detalhar a atividade e responder 404 para inexistente ou malformada', async () => {
      const encontrada = await chamarApi(ATIVIDADE, 'GET', {
        token,
        parametros: { id: String(cenario.faturasFinanceiro) },
      });
      const inexistente = await chamarApi(ATIVIDADE, 'GET', {
        token,
        parametros: { id: ATIVIDADE_INEXISTENTE },
      });
      const malformada = await chamarApi(ATIVIDADE, 'GET', {
        token,
        parametros: { id: '1e3' },
      });

      expect(lerAtividade(encontrada.corpo.dados)).toEqual(
        expect.objectContaining({
          titulo: TITULOS_CENARIO.faturasFinanceiro,
          solicitante: 'Financeiro',
          tags: [expect.objectContaining({ nome: 'Faturas' })],
        }),
      );
      expect(inexistente.status).toBe(404);
      expect(inexistente.corpo.erro?.codigo).toBe('atividade-inexistente');
      expect(malformada.status).toBe(404);
      expect(malformada.corpo.erro?.codigo).toBe('recurso-inexistente');
    });
  });

  describe('criação', () => {
    it('deve criar com 201, Location e valores padrão, visível no quadro da interface', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: '  Criada pelo agente  ', tags: ['faturas', 'Nova'] },
      });

      const criada = lerAtividade(resposta.corpo.dados);
      expect(resposta.status).toBe(201);
      expect(resposta.cabecalhos.get('location')).toBe(
        `/api/v1/atividades/${criada.id}`,
      );
      expect(criada).toEqual(
        expect.objectContaining({
          titulo: 'Criada pelo agente',
          prioridade: PRIORIDADE_PADRAO,
          solicitante: SOLICITANTE_PADRAO_TESTE,
          versao: 1,
          posicao: 3,
          status: expect.objectContaining({ id: aFazerId }),
          tags: [
            expect.objectContaining({ nome: 'Faturas' }),
            expect.objectContaining({ nome: 'Nova' }),
          ],
        }),
      );
      const colunaNaInterface = consultarQuadro(banco, AGORA_TESTE)?.colunas[0];
      expect(colunaNaInterface?.atividades[criada.posicao ?? -1]?.id).toBe(
        criada.id,
      );
      expect(contarLinhas(banco, 'tags')).toBe(4);
    });

    it('deve devolver os erros do mesmo esquema da interface, por campo, sem gravar', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: '   ', prioridade: 12, prazoHora: '10:00' },
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.campos).toEqual({
        titulo: ['Informe o título da atividade.'],
        prioridade: [
          'Escolha uma prioridade de 0 (mais alta) a 9 (mais baixa).',
        ],
        prazoData: ['Informe a data para usar a hora.'],
      });
      expect(contarLinhas(banco, 'atividades')).toBe(6);
    });

    it('deve responder 404 para status inexistente', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: 'Sem coluna', statusId: 9999 },
      });

      expect(resposta.status).toBe(404);
      expect(resposta.corpo.erro?.codigo).toBe('status-inexistente');
    });
  });

  describe('atualização e prioridade', () => {
    it('deve alterar só a prioridade e preservar os demais campos', async () => {
      const resposta = await chamarApi(ATIVIDADE, 'PATCH', {
        token,
        parametros: { id: String(cenario.faturasBugsEu) },
        corpo: { versaoEsperada: 1, prioridade: PRIORIDADE_URGENTE },
      });

      const atualizada = lerAtividade(resposta.corpo.dados);
      expect(resposta.status).toBe(200);
      // A prioridade mais alta leva a atividade ao topo (ordem automática).
      expect(atualizada).toEqual(
        expect.objectContaining({
          prioridade: PRIORIDADE_URGENTE,
          versao: 2,
          titulo: TITULOS_CENARIO.faturasBugsEu,
          solicitante: 'Eu',
          posicao: 0,
        }),
      );
      expect(atualizada.tags.map((tag) => tag.nome)).toEqual([
        'Bugs',
        'Faturas',
      ]);
      expect(
        consultarDetalheAtividade(banco, cenario.faturasBugsEu)?.atividade
          .prioridade,
      ).toBe(PRIORIDADE_URGENTE);
    });

    it('deve registrar no histórico o token que alterou', async () => {
      await chamarApi(ATIVIDADE, 'PATCH', {
        token,
        parametros: { id: String(cenario.faturasBugsEu) },
        corpo: { versaoEsperada: 1, prioridade: PRIORIDADE_URGENTE },
      });

      const [evento] = consultarHistoricoAtividade(
        banco,
        cenario.faturasBugsEu,
      ).eventos;
      expect(evento).toEqual(
        expect.objectContaining({
          tipo: 'edicao',
          origem: 'api',
          autor: 'Agente de teste',
          alteracoes: [
            {
              campo: 'prioridade',
              antes: '5',
              depois: String(PRIORIDADE_URGENTE),
            },
          ],
        }),
      );
    });

    it('deve recusar versão desatualizada com 409 sem sobrescrever', async () => {
      const resposta = await chamarApi(ATIVIDADE, 'PATCH', {
        token,
        parametros: { id: String(cenario.faturasBugsEu) },
        corpo: { versaoEsperada: 7, titulo: 'Atropelada' },
      });

      expect(resposta.status).toBe(409);
      expect(resposta.corpo.erro?.codigo).toBe('conflito-de-versao');
      expect(buscarAtividadeGravada(banco, cenario.faturasBugsEu).titulo).toBe(
        TITULOS_CENARIO.faturasBugsEu,
      );
    });

    it('deve exigir ao menos um campo além da versão', async () => {
      const resposta = await chamarApi(ATIVIDADE, 'PATCH', {
        token,
        parametros: { id: String(cenario.faturasBugsEu) },
        corpo: { versaoEsperada: 1 },
      });

      expect(resposta.status).toBe(400);
    });

    it('deve limpar a descrição com null e mover para o fim ao trocar o status', async () => {
      const resposta = await chamarApi(ATIVIDADE, 'PATCH', {
        token,
        parametros: { id: String(cenario.faturasFinanceiro) },
        corpo: { versaoEsperada: 1, descricao: null, statusId: concluidosId },
      });

      const atualizada = lerAtividade(resposta.corpo.dados);
      expect(atualizada.descricao).toBeNull();
      expect(atualizada.status.id).toBe(concluidosId);
      expect(atualizada.concluidaEmData).not.toBeNull();
      expect(listarIdsAtivosDoStatus(banco, concluidosId)).toEqual([
        cenario.faturasFinanceiro,
      ]);
    });

    it('deve recusar editar arquivada com 409', async () => {
      const resposta = await chamarApi(ATIVIDADE, 'PATCH', {
        token,
        parametros: { id: String(cenario.arquivadaFaturasFinanceiro) },
        corpo: { versaoEsperada: 2, titulo: 'Não pode' },
      });

      expect(resposta.status).toBe(409);
      expect(resposta.corpo.erro?.codigo).toBe('atividade-arquivada');
    });
  });

  describe('movimento e reordenação', () => {
    it('deve mover para outro status na posição pedida e avançar a versão', async () => {
      const resposta = await chamarApi(MOVER_ATIVIDADE, 'POST', {
        token,
        parametros: { id: String(cenario.bugsFinanceiro) },
        corpo: { versaoEsperada: 1, statusId: emAndamentoId, posicao: 0 },
      });

      const movida = lerAtividade(resposta.corpo.dados);
      expect(movida).toEqual(
        expect.objectContaining({ posicao: 0, versao: 2 }),
      );
      expect(movida.status.id).toBe(emAndamentoId);
    });

    it('deve aceitar posição na própria coluna sem alterar a ordem automática nem a versão', async () => {
      const ordemAntes = consultarIdsDaColunaNoQuadro(banco, aFazerId);

      const resposta = await chamarApi(MOVER_ATIVIDADE, 'POST', {
        token,
        parametros: { id: String(cenario.outrosEu) },
        corpo: { versaoEsperada: 1, posicao: 0 },
      });

      expect(resposta.status).toBe(200);
      expect(lerAtividade(resposta.corpo.dados)).toEqual(
        expect.objectContaining({ posicao: 4, versao: 1 }),
      );
      expect(consultarIdsDaColunaNoQuadro(banco, aFazerId)).toEqual(ordemAntes);
    });

    it('deve manter a posição automática mesmo com posição além do fim', async () => {
      const resposta = await chamarApi(MOVER_ATIVIDADE, 'POST', {
        token,
        parametros: { id: String(cenario.faturasFinanceiro) },
        corpo: { versaoEsperada: 1, posicao: 500 },
      });

      expect(lerAtividade(resposta.corpo.dados).posicao).toBe(1);
    });

    it('deve recusar movimento com versão desatualizada sem mexer na ordem', async () => {
      const ordemAntes = listarIdsAtivosDoStatus(banco, aFazerId);

      const resposta = await chamarApi(MOVER_ATIVIDADE, 'POST', {
        token,
        parametros: { id: String(cenario.outrosEu) },
        corpo: { versaoEsperada: 3, statusId: emAndamentoId },
      });

      expect(resposta.status).toBe(409);
      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual(ordemAntes);
    });
  });

  describe('arquivamento', () => {
    it('deve arquivar e desarquivar, com efeito na tela de arquivadas', async () => {
      const id = String(cenario.semTagsFinanceiro);

      const arquivada = await chamarApi(ARQUIVAR, 'POST', {
        token,
        parametros: { id },
        corpo: { versaoEsperada: 1 },
      });
      const naInterface = listarAtividadesArquivadas(banco)?.atividades.map(
        (atividade) => atividade.id,
      );
      const restaurada = await chamarApi(DESARQUIVAR, 'POST', {
        token,
        parametros: { id },
        corpo: { versaoEsperada: 2 },
      });

      expect(lerAtividade(arquivada.corpo.dados)).toEqual(
        expect.objectContaining({ arquivada: true, posicao: null }),
      );
      expect(naInterface).toContain(cenario.semTagsFinanceiro);
      // Restaurada, volta ao lugar que a ordem automática lhe dá (4ª criada).
      expect(lerAtividade(restaurada.corpo.dados)).toEqual(
        expect.objectContaining({ arquivada: false, posicao: 3, versao: 3 }),
      );
    });

    it('deve recusar desarquivar atividade ativa com 409', async () => {
      const resposta = await chamarApi(DESARQUIVAR, 'POST', {
        token,
        parametros: { id: String(cenario.outrosEu) },
        corpo: { versaoEsperada: 1 },
      });

      expect(resposta.status).toBe(409);
      expect(resposta.corpo.erro?.codigo).toBe('atividade-nao-arquivada');
    });
  });

  describe('sincronismo com a interface', () => {
    it('deve enxergar na API o movimento feito pelo quadro', async () => {
      moverAtividade(
        banco,
        {
          atividadeId: cenario.outrosEu,
          versaoEsperada: 1,
          statusDestinoId: emAndamentoId,
          ordemDestino: [cenario.outrosEu],
        },
        AGORA_TESTE,
      );

      const resposta = await chamarApi(ATIVIDADE, 'GET', {
        token,
        parametros: { id: String(cenario.outrosEu) },
      });

      expect(lerAtividade(resposta.corpo.dados)).toEqual(
        expect.objectContaining({
          versao: 2,
          posicao: 0,
          status: expect.objectContaining({ id: emAndamentoId }),
        }),
      );
    });

    it('deve recusar na API a versão que a interface já ultrapassou', async () => {
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, { titulo: 'Editada na tela' }),
          atividadeId: cenario.outrosEu,
          versaoEsperada: 1,
        },
        AGORA_TESTE,
      );

      const resposta = await chamarApi(ATIVIDADE, 'PATCH', {
        token,
        parametros: { id: String(cenario.outrosEu) },
        corpo: { versaoEsperada: 1, titulo: 'Editada pelo agente' },
      });

      expect(resposta.status).toBe(409);
      expect(buscarAtividadeGravada(banco, cenario.outrosEu).titulo).toBe(
        'Editada na tela',
      );
    });
  });

  describe('status', () => {
    it('deve criar, renomear, mover e excluir status como a tela de status', async () => {
      const criado = await chamarApi(STATUS, 'POST', {
        token,
        corpo: { nome: 'Em revisão', finalizaAtividade: true },
      });
      const statusId = (criado.corpo.dados as { id: number }).id;
      const renomeado = await chamarApi(UM_STATUS, 'PATCH', {
        token,
        parametros: { id: String(statusId) },
        corpo: { versaoEsperada: 1, nome: 'Revisão final' },
      });
      const movido = await chamarApi(MOVER_STATUS, 'POST', {
        token,
        parametros: { id: String(statusId) },
        corpo: { posicao: 0 },
      });
      const excluido = await chamarApi(UM_STATUS, 'DELETE', {
        token,
        parametros: { id: String(statusId) },
        consulta: '?versaoEsperada=2',
      });

      expect(criado.status).toBe(201);
      expect(criado.cabecalhos.get('location')).toBe(
        `/api/v1/status/${statusId}`,
      );
      expect(renomeado.corpo.dados).toEqual(
        expect.objectContaining({
          nome: 'Revisão final',
          finalizaAtividade: true,
          versao: 2,
        }),
      );
      expect(esquemaListaStatusApi.parse(movido.corpo.dados)[0]?.id).toBe(
        statusId,
      );
      expect(excluido.corpo.dados).toEqual({ statusId, atividadesMovidas: 0 });
      expect(listarStatusDoBoard(banco, exigirBoardId(banco))).toHaveLength(4);
    });

    it('deve recusar nome repetido sem diferença de acento', async () => {
      const resposta = await chamarApi(STATUS, 'POST', {
        token,
        corpo: { nome: 'a fazer' },
      });

      expect(resposta.status).toBe(409);
      expect(resposta.corpo.erro?.codigo).toBe('nome-status-repetido');
    });

    it('deve exigir destino ao excluir status com atividades e mover sem apagar', async () => {
      const semDestino = await chamarApi(UM_STATUS, 'DELETE', {
        token,
        parametros: { id: String(aFazerId) },
        consulta: '?versaoEsperada=1',
      });
      const comDestino = await chamarApi(UM_STATUS, 'DELETE', {
        token,
        parametros: { id: String(aFazerId) },
        consulta: `?versaoEsperada=1&statusDestinoId=${emAndamentoId}`,
      });

      expect(semDestino.status).toBe(400);
      expect(semDestino.corpo.erro?.codigo).toBe('destino-obrigatorio');
      expect(comDestino.corpo.dados).toEqual({
        statusId: aFazerId,
        atividadesMovidas: 6,
      });
      expect(contarLinhas(banco, 'atividades')).toBe(6);
    });

    it('deve recusar renomear com versão desatualizada e exclusão sem versão', async () => {
      const renomeacao = await chamarApi(UM_STATUS, 'PATCH', {
        token,
        parametros: { id: String(emAndamentoId) },
        corpo: { versaoEsperada: 5, nome: 'Fazendo' },
      });
      const exclusao = await chamarApi(UM_STATUS, 'DELETE', {
        token,
        parametros: { id: String(emAndamentoId) },
      });

      expect(renomeacao.status).toBe(409);
      expect(exclusao.status).toBe(400);
      expect(exclusao.corpo.erro?.campos).toHaveProperty('versaoEsperada');
    });
  });

  describe('tags', () => {
    it('deve listar, criar, renomear e excluir tags', async () => {
      const criada = await chamarApi(TAGS, 'POST', {
        token,
        corpo: { nome: '  Revisão  ' },
      });
      const tagId = (criada.corpo.dados as { id: number }).id;
      const renomeada = await chamarApi(UMA_TAG, 'PATCH', {
        token,
        parametros: { id: String(tagId) },
        corpo: { nomeAtual: 'Revisão', nome: 'Revisão de código' },
      });
      const lista = await chamarApi(TAGS, 'GET', { token });
      const excluida = await chamarApi(UMA_TAG, 'DELETE', {
        token,
        parametros: { id: String(tagId) },
        consulta: `?nomeAtual=${encodeURIComponent('Revisão de código')}`,
      });

      expect(criada.status).toBe(201);
      expect(renomeada.corpo.dados).toEqual(
        expect.objectContaining({ nome: 'Revisão de código' }),
      );
      expect(lista.corpo.dados).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ nome: 'Faturas', quantidadeAtividades: 3 }),
        ]),
      );
      expect(excluida.corpo.dados).toEqual({ tagId, atividadesAfetadas: 0 });
    });

    it('deve definir o solicitante padrão da tag e usá-lo em atividade sem solicitante', async () => {
      const criada = await chamarApi(TAGS, 'POST', {
        token,
        corpo: { nome: 'Plantão', solicitantePadrao: 'Equipe de plantão' },
      });
      const tagId = (criada.corpo.dados as { id: number }).id;
      const atividade = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: 'Chamado noturno', tags: ['Faturas', 'plantao'] },
      });
      const removido = await chamarApi(UMA_TAG, 'PATCH', {
        token,
        parametros: { id: String(tagId) },
        corpo: { nomeAtual: 'Plantão', solicitantePadrao: null },
      });
      const semPadrao = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: 'Outro chamado', tags: ['Plantão'] },
      });

      expect(criada.corpo.dados).toEqual(
        expect.objectContaining({ solicitantePadrao: 'Equipe de plantão' }),
      );
      expect(lerAtividade(atividade.corpo.dados).solicitante).toBe(
        'Equipe de plantão',
      );
      expect(removido.corpo.dados).toEqual(
        expect.objectContaining({ solicitantePadrao: null }),
      );
      expect(lerAtividade(semPadrao.corpo.dados).solicitante).toBe(
        SOLICITANTE_PADRAO_TESTE,
      );
    });

    it('deve recusar duplicata e renomeação com nome atual divergente', async () => {
      const duplicada = await chamarApi(TAGS, 'POST', {
        token,
        corpo: { nome: 'faturas' },
      });
      const divergente = await chamarApi(UMA_TAG, 'PATCH', {
        token,
        parametros: { id: String(exigirIdTag(banco, 'Bugs')) },
        corpo: { nomeAtual: 'Bug', nome: 'Defeitos' },
      });

      expect(duplicada.status).toBe(409);
      expect(divergente.status).toBe(409);
    });

    it('deve recusar excluir tag do escopo de um link ativo', async () => {
      const tagId = exigirIdTag(banco, 'Diretoria');
      criarLinkDeTeste(banco, { tagIds: [tagId] });

      const resposta = await chamarApi(UMA_TAG, 'DELETE', {
        token,
        parametros: { id: String(tagId) },
        consulta: '?nomeAtual=Diretoria',
      });

      expect(resposta.status).toBe(409);
      expect(resposta.corpo.erro?.codigo).toBe('tag-em-compartilhamento');
    });
  });

  describe('solicitantes', () => {
    it('deve listar e cadastrar sem duplicar variações de acento e caixa', async () => {
      const novo = await chamarApi(SOLICITANTES, 'POST', {
        token,
        corpo: { nome: 'Diretoria Comercial' },
      });
      const repetido = await chamarApi(SOLICITANTES, 'POST', {
        token,
        corpo: { nome: 'FINANCEIRO' },
      });
      const lista = await chamarApi(SOLICITANTES, 'GET', { token });

      expect(novo.status).toBe(201);
      expect(novo.corpo.dados).toEqual(
        expect.objectContaining({ nome: 'Diretoria Comercial', criado: true }),
      );
      expect(repetido.status).toBe(200);
      expect(repetido.corpo.dados).toEqual(
        expect.objectContaining({ nome: 'Financeiro', criado: false }),
      );
      expect(lista.corpo.dados).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            nome: 'Financeiro',
            quantidadeAtividades: 4,
            padrao: false,
          }),
          expect.objectContaining({
            nome: SOLICITANTE_PADRAO_TESTE,
            padrao: true,
          }),
        ]),
      );
    });

    it('deve recusar atividade sem solicitante quando o board não tem padrão', async () => {
      banco.$client.prepare('UPDATE solicitantes SET padrao = 0').run();

      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: 'Sem solicitante', solicitante: '  ' },
      });
      const comNome = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: 'Com solicitante', solicitante: 'Financeiro' },
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.codigo).toBe('solicitante-obrigatorio');
      expect(comNome.status).toBe(201);
    });

    it('deve recusar nome em branco', async () => {
      const resposta = await chamarApi(SOLICITANTES, 'POST', {
        token,
        corpo: { nome: '   ' },
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.campos?.nome).toEqual([
        'Informe o nome do solicitante.',
      ]);
    });
  });
});
