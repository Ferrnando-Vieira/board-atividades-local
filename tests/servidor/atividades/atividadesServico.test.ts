import { eq } from 'drizzle-orm';
import { PRIORIDADE } from '@/config/constantes';
import {
  CODIGO_CONFLITO_ORDEM,
  CODIGO_CONFLITO_VERSAO,
} from '@/servidor/banco/concorrencia';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { atividades, solicitantes } from '@/servidor/banco/esquema';
import {
  CODIGO_ATIVIDADE_ARQUIVADA,
  CODIGO_ATIVIDADE_NAO_ARQUIVADA,
  listarIdsAtivosDoStatus,
} from '@/servidor/atividades/atividadesRepositorio';
import {
  arquivarAtividade,
  criarAtividade,
  desarquivarAtividade,
  editarAtividade,
  moverAtividade,
} from '@/servidor/atividades/atividadesServico';
import { CODIGO_STATUS_INEXISTENTE } from '@/servidor/board/boardRepositorio';
import { consultarQuadro } from '@/servidor/board/consultaQuadro';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import {
  AGORA_TESTE,
  buscarAtividadeGravada,
  criarAtividadesNoStatus,
  exigirStatusPorChave,
  listarNomesTagsDaAtividade,
  montarDadosAtividade,
  MOMENTO_LOCAL_TESTE,
} from '@/tests/suporte/fabricasAtividades';

const VERSAO_INICIAL = 1;
const STATUS_INEXISTENTE = 9999;
const PRIORIDADE_ALTA = 0;
const PRIORIDADE_BAIXA = 9;
const LEMBRETE_HISTORICO = '2026-09-30T16:45:00.000Z';
const DATA_CONCLUSAO_ORIGINAL = '2026-09-23';
const TITULOS_A_FAZER = ['Primeira', 'Segunda', 'Terceira'];

describe('atividadesServico', () => {
  let banco: BancoDados;
  let aFazerId: number;
  let emAndamentoId: number;
  let concluidosId: number;

  beforeEach(() => {
    banco = criarBancoInicializado();
    aFazerId = exigirStatusPorChave(banco, 'a-fazer').id;
    emAndamentoId = exigirStatusPorChave(banco, 'em-andamento').id;
    concluidosId = exigirStatusPorChave(banco, 'concluidos').id;
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('criarAtividade', () => {
    it('deve criar com prioridade padrão, solicitante Eu e no fim da coluna', () => {
      const [primeiraId] = criarAtividadesNoStatus(banco, aFazerId, ['Antiga']);

      const { atividadeId, versao } = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { titulo: 'Nova' }),
        AGORA_TESTE,
      );

      const gravada = buscarAtividadeGravada(banco, atividadeId);
      expect(gravada.prioridade).toBe(PRIORIDADE.PADRAO);
      expect(versao).toBe(VERSAO_INICIAL);
      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual([
        primeiraId,
        atividadeId,
      ]);
      expect(contarLinhas(banco, 'solicitantes')).toBe(1);
    });

    it('deve reutilizar o solicitante já cadastrado com outra grafia', () => {
      const primeira = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { solicitante: 'Financeiro' }),
        AGORA_TESTE,
      );

      const segunda = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { solicitante: 'financeiro' }),
        AGORA_TESTE,
      );

      expect(
        buscarAtividadeGravada(banco, segunda.atividadeId).solicitanteId,
      ).toBe(buscarAtividadeGravada(banco, primeira.atividadeId).solicitanteId);
      expect(contarLinhas(banco, 'solicitantes')).toBe(2);
    });

    it('deve vincular as tags reutilizando o cadastro normalizado', () => {
      criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { tags: ['Faturas'] }),
        AGORA_TESTE,
      );

      const { atividadeId } = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { tags: ['faturas', 'Infra'] }),
        AGORA_TESTE,
      );

      expect(listarNomesTagsDaAtividade(banco, atividadeId)).toEqual([
        'Faturas',
        'Infra',
      ]);
      expect(contarLinhas(banco, 'tags')).toBe(2);
    });

    it('deve registrar a conclusão no momento atual ao criar num status que finaliza', () => {
      const { atividadeId } = criarAtividade(
        banco,
        montarDadosAtividade(concluidosId),
        AGORA_TESTE,
      );

      const gravada = buscarAtividadeGravada(banco, atividadeId);
      expect(gravada.concluidaEmData).toBe(MOMENTO_LOCAL_TESTE.data);
      expect(gravada.concluidaEmHora).toBe(MOMENTO_LOCAL_TESTE.hora);
    });

    it('deve ignorar conclusão informada num status que não finaliza', () => {
      const { atividadeId } = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, {
          concluidaEmData: DATA_CONCLUSAO_ORIGINAL,
        }),
        AGORA_TESTE,
      );

      expect(
        buscarAtividadeGravada(banco, atividadeId).concluidaEmData,
      ).toBeNull();
    });

    it('deve gravar prazo com data e hora', () => {
      const { atividadeId } = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, {
          prazoData: '2026-10-15',
          prazoHora: '09:30',
        }),
        AGORA_TESTE,
      );

      const gravada = buscarAtividadeGravada(banco, atividadeId);
      expect(gravada.prazoData).toBe('2026-10-15');
      expect(gravada.prazoHora).toBe('09:30');
    });

    it('deve recusar status inexistente sem gravar nada', () => {
      expect(() =>
        criarAtividade(
          banco,
          montarDadosAtividade(STATUS_INEXISTENTE, { tags: ['Nova tag'] }),
          AGORA_TESTE,
        ),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_STATUS_INEXISTENTE }));
      expect(contarLinhas(banco, 'atividades')).toBe(0);
      expect(contarLinhas(banco, 'tags')).toBe(0);
    });
  });

  describe('editarAtividade', () => {
    let atividadeId: number;

    beforeEach(() => {
      atividadeId = criarAtividade(
        banco,
        montarDadosAtividade(aFazerId, { tags: ['Faturas', 'Bugs'] }),
        AGORA_TESTE,
      ).atividadeId;
    });

    function editar(sobrescritas: Parameters<typeof montarDadosAtividade>[1]) {
      return editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, sobrescritas),
          atividadeId,
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );
    }

    it('deve gravar os campos e incrementar a versão', () => {
      const resultado = editar({
        titulo: 'Título revisado',
        descricao: 'Detalhes',
        prioridade: PRIORIDADE_ALTA,
        solicitante: 'Diretoria',
      });

      const gravada = buscarAtividadeGravada(banco, atividadeId);
      expect(resultado.versao).toBe(VERSAO_INICIAL + 1);
      expect(gravada).toEqual(
        expect.objectContaining({
          titulo: 'Título revisado',
          descricao: 'Detalhes',
          prioridade: PRIORIDADE_ALTA,
          versao: VERSAO_INICIAL + 1,
        }),
      );
      const solicitante = banco
        .select({ nome: solicitantes.nome })
        .from(solicitantes)
        .where(eq(solicitantes.id, gravada.solicitanteId))
        .get();
      expect(solicitante?.nome).toBe('Diretoria');
    });

    it('deve recusar a edição feita sobre uma versão desatualizada sem alterar nada', () => {
      editar({ titulo: 'Primeira edição' });

      expect(() => editar({ titulo: 'Edição atrasada' })).toThrow(
        expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }),
      );
      expect(buscarAtividadeGravada(banco, atividadeId).titulo).toBe(
        'Primeira edição',
      );
    });

    it('deve substituir as tags removendo as desmarcadas', () => {
      editar({ tags: ['Bugs', 'Reforma tributária'] });

      expect(listarNomesTagsDaAtividade(banco, atividadeId)).toEqual([
        'Bugs',
        'Reforma tributária',
      ]);
    });

    it('deve levar a atividade ao fim da nova coluna ao trocar o status', () => {
      const existentes = criarAtividadesNoStatus(banco, emAndamentoId, [
        'Em curso',
      ]);

      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(emAndamentoId),
          atividadeId,
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );

      expect(listarIdsAtivosDoStatus(banco, emAndamentoId)).toEqual([
        ...existentes,
        atividadeId,
      ]);
      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual([]);
    });

    it('deve alterar a prioridade sem mexer na ordem manual', () => {
      criarAtividadesNoStatus(banco, aFazerId, ['Segunda']);
      const ordemAntes = listarIdsAtivosDoStatus(banco, aFazerId);

      editar({ prioridade: PRIORIDADE_BAIXA });

      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual(ordemAntes);
      expect(buscarAtividadeGravada(banco, atividadeId).prioridade).toBe(
        PRIORIDADE_BAIXA,
      );
    });

    it('deve registrar a conclusão ao entrar num status que finaliza e limpar ao sair', () => {
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(concluidosId),
          atividadeId,
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );
      const concluida = buscarAtividadeGravada(banco, atividadeId);

      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, {
            concluidaEmData: concluida.concluidaEmData,
          }),
          atividadeId,
          versaoEsperada: concluida.versao,
        },
        AGORA_TESTE,
      );

      expect(concluida.concluidaEmData).toBe(MOMENTO_LOCAL_TESTE.data);
      expect(
        buscarAtividadeGravada(banco, atividadeId).concluidaEmData,
      ).toBeNull();
    });

    it('deve preservar o lembrete, que não faz parte do formulário', () => {
      banco
        .update(atividades)
        .set({ lembreteEm: LEMBRETE_HISTORICO, lembreteSituacao: 'disparado' })
        .where(eq(atividades.id, atividadeId))
        .run();

      editar({ titulo: 'Com lembrete' });

      const gravada = buscarAtividadeGravada(banco, atividadeId);
      expect(gravada.lembreteEm).toBe(LEMBRETE_HISTORICO);
      expect(gravada.lembreteSituacao).toBe('disparado');
    });

    it('deve recusar a edição de atividade arquivada', () => {
      arquivarAtividade(
        banco,
        { atividadeId, versaoEsperada: VERSAO_INICIAL },
        AGORA_TESTE,
      );

      expect(() =>
        editarAtividade(
          banco,
          {
            ...montarDadosAtividade(aFazerId),
            atividadeId,
            versaoEsperada: VERSAO_INICIAL + 1,
          },
          AGORA_TESTE,
        ),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_ATIVIDADE_ARQUIVADA }),
      );
    });
  });

  describe('moverAtividade', () => {
    let idsAFazer: number[];

    beforeEach(() => {
      idsAFazer = criarAtividadesNoStatus(banco, aFazerId, TITULOS_A_FAZER);
    });

    function idAFazer(indice: number): number {
      const id = idsAFazer[indice];
      if (id === undefined) {
        throw new Error(`Atividade ${indice} ausente.`);
      }
      return id;
    }

    it('deve mover para outra coluna na posição indicada e incrementar a versão', () => {
      const [emCursoId = 0] = criarAtividadesNoStatus(banco, emAndamentoId, [
        'Em curso',
      ]);
      const movidaId = idAFazer(1);

      const resultado = moverAtividade(
        banco,
        {
          atividadeId: movidaId,
          versaoEsperada: VERSAO_INICIAL,
          statusDestinoId: emAndamentoId,
          ordemDestino: [movidaId, emCursoId],
        },
        AGORA_TESTE,
      );

      expect(resultado.versao).toBe(VERSAO_INICIAL + 1);
      expect(listarIdsAtivosDoStatus(banco, emAndamentoId)).toEqual([
        movidaId,
        emCursoId,
      ]);
      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual([
        idAFazer(0),
        idAFazer(2),
      ]);
    });

    it('deve reordenar dentro da coluna sem alterar a versão', () => {
      const novaOrdem = [idAFazer(2), idAFazer(0), idAFazer(1)];

      const resultado = moverAtividade(
        banco,
        {
          atividadeId: idAFazer(2),
          versaoEsperada: VERSAO_INICIAL,
          statusDestinoId: aFazerId,
          ordemDestino: novaOrdem,
        },
        AGORA_TESTE,
      );

      expect(resultado.versao).toBe(VERSAO_INICIAL);
      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual(novaOrdem);
      expect(
        banco
          .select({ ordem: atividades.ordem })
          .from(atividades)
          .all()
          .map((linha) => linha.ordem)
          .sort(),
      ).toEqual([0, 1, 2]);
    });

    it('deve exibir a coluna pela prioridade, sem considerar a ordem manual gravada', () => {
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, {
            titulo: 'Terceira',
            prioridade: PRIORIDADE_ALTA,
          }),
          atividadeId: idAFazer(2),
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId, {
            titulo: 'Primeira',
            prioridade: PRIORIDADE_BAIXA,
          }),
          atividadeId: idAFazer(0),
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );

      const quadro = consultarQuadro(banco, AGORA_TESTE);

      const coluna = quadro?.colunas.find((item) => item.id === aFazerId);
      expect(coluna?.atividades.map((cartao) => cartao.prioridade)).toEqual([
        PRIORIDADE_ALTA,
        PRIORIDADE.PADRAO,
        PRIORIDADE_BAIXA,
      ]);
    });

    it('deve recusar o movimento calculado sobre uma coluna desatualizada sem gravar', () => {
      moverAtividade(
        banco,
        {
          atividadeId: idAFazer(0),
          versaoEsperada: VERSAO_INICIAL,
          statusDestinoId: aFazerId,
          ordemDestino: [idAFazer(1), idAFazer(0), idAFazer(2)],
        },
        AGORA_TESTE,
      );
      const ordemAposPrimeiroCliente = listarIdsAtivosDoStatus(banco, aFazerId);

      expect(() =>
        moverAtividade(
          banco,
          {
            atividadeId: idAFazer(2),
            versaoEsperada: VERSAO_INICIAL,
            statusDestinoId: aFazerId,
            ordemDestino: [idAFazer(2), idAFazer(0), idAFazer(1)],
          },
          AGORA_TESTE,
        ),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_ORDEM }));
      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual(
        ordemAposPrimeiroCliente,
      );
    });

    it('deve recusar mover com versão desatualizada', () => {
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(emAndamentoId),
          atividadeId: idAFazer(0),
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );

      expect(() =>
        moverAtividade(
          banco,
          {
            atividadeId: idAFazer(0),
            versaoEsperada: VERSAO_INICIAL,
            statusDestinoId: aFazerId,
            ordemDestino: [idAFazer(1), idAFazer(2), idAFazer(0)],
          },
          AGORA_TESTE,
        ),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }));
      expect(buscarAtividadeGravada(banco, idAFazer(0)).statusId).toBe(
        emAndamentoId,
      );
    });

    it('deve permitir mover para uma coluna vazia', () => {
      moverAtividade(
        banco,
        {
          atividadeId: idAFazer(0),
          versaoEsperada: VERSAO_INICIAL,
          statusDestinoId: emAndamentoId,
          ordemDestino: [idAFazer(0)],
        },
        AGORA_TESTE,
      );

      expect(listarIdsAtivosDoStatus(banco, emAndamentoId)).toEqual([
        idAFazer(0),
      ]);
    });

    it('deve registrar a conclusão ao entrar em Concluídos e limpar ao sair', () => {
      moverAtividade(
        banco,
        {
          atividadeId: idAFazer(0),
          versaoEsperada: VERSAO_INICIAL,
          statusDestinoId: concluidosId,
          ordemDestino: [idAFazer(0)],
        },
        AGORA_TESTE,
      );
      const concluida = buscarAtividadeGravada(banco, idAFazer(0));

      moverAtividade(
        banco,
        {
          atividadeId: idAFazer(0),
          versaoEsperada: concluida.versao,
          statusDestinoId: emAndamentoId,
          ordemDestino: [idAFazer(0)],
        },
        AGORA_TESTE,
      );

      expect(concluida.concluidaEmData).toBe(MOMENTO_LOCAL_TESTE.data);
      expect(concluida.concluidaEmHora).toBe(MOMENTO_LOCAL_TESTE.hora);
      expect(
        buscarAtividadeGravada(banco, idAFazer(0)).concluidaEmData,
      ).toBeNull();
    });

    it('deve tratar como nada a fazer o movimento para a mesma posição', () => {
      const atualizadoAntes = buscarAtividadeGravada(
        banco,
        idAFazer(1),
      ).atualizadoEm;

      const resultado = moverAtividade(
        banco,
        {
          atividadeId: idAFazer(1),
          versaoEsperada: VERSAO_INICIAL,
          statusDestinoId: aFazerId,
          ordemDestino: [...idsAFazer],
        },
        AGORA_TESTE,
      );

      expect(resultado.versao).toBe(VERSAO_INICIAL);
      expect(buscarAtividadeGravada(banco, idAFazer(1)).atualizadoEm).toBe(
        atualizadoAntes,
      );
    });

    it('deve recusar mover atividade arquivada', () => {
      arquivarAtividade(
        banco,
        { atividadeId: idAFazer(0), versaoEsperada: VERSAO_INICIAL },
        AGORA_TESTE,
      );

      expect(() =>
        moverAtividade(
          banco,
          {
            atividadeId: idAFazer(0),
            versaoEsperada: VERSAO_INICIAL + 1,
            statusDestinoId: emAndamentoId,
            ordemDestino: [idAFazer(0)],
          },
          AGORA_TESTE,
        ),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_ATIVIDADE_ARQUIVADA }),
      );
    });
  });

  describe('arquivamento', () => {
    let idsAFazer: number[];

    beforeEach(() => {
      idsAFazer = criarAtividadesNoStatus(banco, aFazerId, TITULOS_A_FAZER);
    });

    it('deve arquivar a atividade e tirá-la do quadro sem apagá-la', () => {
      const [primeiraId = 0, ...restantes] = idsAFazer;

      arquivarAtividade(
        banco,
        { atividadeId: primeiraId, versaoEsperada: VERSAO_INICIAL },
        AGORA_TESTE,
      );

      expect(buscarAtividadeGravada(banco, primeiraId).arquivadaEm).toBe(
        AGORA_TESTE.toISOString(),
      );
      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual(restantes);
      expect(contarLinhas(banco, 'atividades')).toBe(TITULOS_A_FAZER.length);
    });

    it('deve restaurar no fim do status mesmo com a posição antiga ocupada', () => {
      const [primeiraId = 0] = idsAFazer;
      arquivarAtividade(
        banco,
        { atividadeId: primeiraId, versaoEsperada: VERSAO_INICIAL },
        AGORA_TESTE,
      );
      const [novaId] = criarAtividadesNoStatus(banco, aFazerId, ['Nova']);

      const resultado = desarquivarAtividade(banco, {
        atividadeId: primeiraId,
        versaoEsperada: VERSAO_INICIAL + 1,
      });

      expect(resultado.versao).toBe(VERSAO_INICIAL + 2);
      expect(buscarAtividadeGravada(banco, primeiraId).arquivadaEm).toBeNull();
      expect(listarIdsAtivosDoStatus(banco, aFazerId)).toEqual([
        ...idsAFazer.slice(1),
        novaId,
        primeiraId,
      ]);
    });

    it('deve recusar arquivar com versão desatualizada', () => {
      const [primeiraId = 0] = idsAFazer;
      editarAtividade(
        banco,
        {
          ...montarDadosAtividade(aFazerId),
          atividadeId: primeiraId,
          versaoEsperada: VERSAO_INICIAL,
        },
        AGORA_TESTE,
      );

      expect(() =>
        arquivarAtividade(
          banco,
          { atividadeId: primeiraId, versaoEsperada: VERSAO_INICIAL },
          AGORA_TESTE,
        ),
      ).toThrow(expect.objectContaining({ codigo: CODIGO_CONFLITO_VERSAO }));
      expect(buscarAtividadeGravada(banco, primeiraId).arquivadaEm).toBeNull();
    });

    it('deve recusar restaurar atividade que não está arquivada', () => {
      const [primeiraId = 0] = idsAFazer;

      expect(() =>
        desarquivarAtividade(banco, {
          atividadeId: primeiraId,
          versaoEsperada: VERSAO_INICIAL,
        }),
      ).toThrow(
        expect.objectContaining({ codigo: CODIGO_ATIVIDADE_NAO_ARQUIVADA }),
      );
    });
  });
});
