jest.mock('@/servidor/web/bancoAplicacao', () => ({
  CODIGO_BANCO_AUSENTE: 'banco-ausente',
  obterBancoAplicacao: jest.fn(),
}));

import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  esquemaLembreteApi,
  esquemaListaLembretesApi,
} from '@/servidor/api/esquemasApi';
import {
  criarLembreteAvulso,
  dispararLembretesAvulsosVencidos,
} from '@/servidor/lembretes/lembretesAvulsosServico';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import { chamarApi, MODULOS_ROTA_API } from '@/tests/suporte/clienteApi';
import {
  cadastrarAdministrador,
  criarTokenApiDeTeste,
} from '@/tests/suporte/fabricasCompartilhamento';
import type { z } from 'zod';

type LembreteApi = z.output<typeof esquemaLembreteApi>;

function exigirRota(caminho: string) {
  const modulo = MODULOS_ROTA_API[caminho];
  if (!modulo) {
    throw new Error(`Rota ${caminho} ausente no mapa de teste.`);
  }
  return modulo;
}

const LEMBRETES = exigirRota('/api/v1/lembretes');
const UM_LEMBRETE = exigirRota('/api/v1/lembretes/{id}');
const DESATIVAR = exigirRota('/api/v1/lembretes/{id}/desativar');
const REATIVAR = exigirRota('/api/v1/lembretes/{id}/reativar');

// O fuso do board é America/Sao_Paulo (UTC−3): 10:00 local = 13:00 UTC.
const FUTURO = { lembreteData: '2099-01-01', lembreteHora: '10:00' };
const FUTURO_UTC = '2099-01-01T13:00:00.000Z';
const OUTRO_FUTURO = { lembreteData: '2099-02-03', lembreteHora: '08:30' };
const PASSADO = { lembreteData: '2020-01-01', lembreteHora: '10:00' };
const JA_DISPAROU = { lembreteData: '2020-06-01', lembreteHora: '10:00' };
const INEXISTENTE = '99999';

describe('API: lembretes avulsos', () => {
  let banco: BancoDados;
  let token: string;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    token = criarTokenApiDeTeste(banco, [
      'atividades:ler',
      'atividades:escrever',
    ]);
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  function lerLembrete(dados: unknown): LembreteApi {
    return esquemaLembreteApi.parse(dados);
  }

  async function criar(
    corpo: Record<string, unknown> = {},
  ): Promise<LembreteApi> {
    const resposta = await chamarApi(LEMBRETES, 'POST', {
      token,
      corpo: { titulo: 'Revisar checklist de publicação', ...FUTURO, ...corpo },
    });
    expect(resposta.status).toBe(201);
    return lerLembrete(resposta.corpo.dados);
  }

  // Um lembrete que já disparou, num horário que passou em relação ao relógio
  // real (que a API usa): criado e disparado "em 2020". Os pendentes de 2099
  // ficam de fora do disparo.
  function criarDisparado(titulo: string): number {
    const { lembreteId } = criarLembreteAvulso(
      banco,
      { titulo, observacao: null, ...JA_DISPAROU },
      new Date('2020-01-01T00:00:00Z'),
    );
    dispararLembretesAvulsosVencidos(banco, new Date('2020-07-01T00:00:00Z'));
    return lembreteId;
  }

  describe('criar', () => {
    it('deve criar pendente, com o horário do fuso do board convertido para UTC', async () => {
      const resposta = await chamarApi(LEMBRETES, 'POST', {
        token,
        corpo: {
          titulo: '  Revisar   checklist de publicação em staging ',
          observacao: 'Fluxo completo, com e-mail',
          ...FUTURO,
        },
      });

      expect(resposta.status).toBe(201);
      const lembrete = lerLembrete(resposta.corpo.dados);
      expect(lembrete).toEqual({
        id: expect.any(Number),
        titulo: 'Revisar checklist de publicação em staging',
        observacao: 'Fluxo completo, com e-mail',
        lembreteEm: FUTURO_UTC,
        lembreteData: '2099-01-01',
        lembreteHora: '10:00',
        situacao: 'pendente',
        disparadoEm: null,
        dispensadoEm: null,
        versao: 1,
      });
      expect(resposta.cabecalhos.get('location')).toBe(
        `/api/v1/lembretes/${lembrete.id}`,
      );
      expect(contarLinhas(banco, 'lembretes_avulsos')).toBe(1);
    });

    it('deve aceitar a observação em branco ou ausente como nula', async () => {
      const semCampo = await criar();
      const emBranco = await criar({ observacao: '   ' });

      expect(semCampo.observacao).toBeNull();
      expect(emBranco.observacao).toBeNull();
    });

    it('deve recusar horário que já passou, sem gravar', async () => {
      const resposta = await chamarApi(LEMBRETES, 'POST', {
        token,
        corpo: { titulo: 'Ontem', ...PASSADO },
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.codigo).toBe('lembrete-no-passado');
      expect(contarLinhas(banco, 'lembretes_avulsos')).toBe(0);
    });

    it('deve apontar o campo inválido com a mensagem da interface', async () => {
      const resposta = await chamarApi(LEMBRETES, 'POST', {
        token,
        corpo: {
          titulo: '   ',
          lembreteData: '2099-13-45',
          lembreteHora: '25:00',
        },
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.codigo).toBe('dados-invalidos');
      expect(resposta.corpo.erro?.campos).toEqual(
        expect.objectContaining({
          titulo: ['Informe o título do lembrete.'],
          lembreteData: expect.any(Array),
          lembreteHora: expect.any(Array),
        }),
      );
      expect(contarLinhas(banco, 'lembretes_avulsos')).toBe(0);
    });

    it('deve recusar campo desconhecido e corpo sem data ou hora', async () => {
      const desconhecido = await chamarApi(LEMBRETES, 'POST', {
        token,
        corpo: { titulo: 'X', ...FUTURO, prioridade: 1 },
      });
      const semHora = await chamarApi(LEMBRETES, 'POST', {
        token,
        corpo: { titulo: 'X', lembreteData: '2099-01-01' },
      });

      expect(desconhecido.status).toBe(400);
      expect(semHora.status).toBe(400);
      expect(contarLinhas(banco, 'lembretes_avulsos')).toBe(0);
    });
  });

  describe('listar e ler', () => {
    it('deve listar pendentes por horário e depois os disparados', async () => {
      const tarde = await criar({ titulo: 'Tarde', ...OUTRO_FUTURO });
      const cedo = await criar({ titulo: 'Cedo' });
      const disparadoId = criarDisparado('Já avisado');

      const resposta = await chamarApi(LEMBRETES, 'GET', { token });

      expect(resposta.status).toBe(200);
      const lista = esquemaListaLembretesApi.parse(resposta.corpo.dados);
      expect(lista.map((item) => item.id)).toEqual([
        cedo.id,
        tarde.id,
        disparadoId,
      ]);
      expect(lista.at(-1)).toEqual(
        expect.objectContaining({
          situacao: 'disparado',
          disparadoEm: '2020-07-01T00:00:00.000Z',
        }),
      );
    });

    it('deve filtrar por situação e recusar situação desconhecida', async () => {
      await criar({ titulo: 'Pendente' });
      criarDisparado('Disparado');

      const disparados = await chamarApi(LEMBRETES, 'GET', {
        token,
        consulta: '?situacao=disparado',
      });
      const invalida = await chamarApi(LEMBRETES, 'GET', {
        token,
        consulta: '?situacao=feito',
      });
      const parametroErrado = await chamarApi(LEMBRETES, 'GET', {
        token,
        consulta: '?status=disparado',
      });

      expect(
        esquemaListaLembretesApi
          .parse(disparados.corpo.dados)
          .map((item) => item.titulo),
      ).toEqual(['Disparado']);
      expect(invalida.status).toBe(400);
      expect(parametroErrado.corpo.erro?.codigo).toBe('parametro-desconhecido');
    });

    it('deve ler um lembrete e responder 404 para inexistente ou id malformado', async () => {
      const criado = await criar();

      const lido = await chamarApi(UM_LEMBRETE, 'GET', {
        token,
        parametros: { id: String(criado.id) },
      });
      const inexistente = await chamarApi(UM_LEMBRETE, 'GET', {
        token,
        parametros: { id: INEXISTENTE },
      });
      const malformado = await chamarApi(UM_LEMBRETE, 'GET', {
        token,
        parametros: { id: '1e3' },
      });

      expect(lerLembrete(lido.corpo.dados)).toEqual(criado);
      expect(inexistente.status).toBe(404);
      expect(inexistente.corpo.erro?.codigo).toBe(
        'lembrete-avulso-inexistente',
      );
      expect(malformado.status).toBe(404);
    });
  });

  describe('atualizar', () => {
    it('deve mudar só o título, mantendo o horário, e avançar a versão', async () => {
      const criado = await criar();

      const resposta = await chamarApi(UM_LEMBRETE, 'PATCH', {
        token,
        parametros: { id: String(criado.id) },
        corpo: { versaoEsperada: criado.versao, titulo: 'Novo título' },
      });

      expect(resposta.status).toBe(200);
      expect(lerLembrete(resposta.corpo.dados)).toEqual({
        ...criado,
        titulo: 'Novo título',
        versao: criado.versao + 1,
      });
    });

    it('deve remarcar, trocar e limpar a observação', async () => {
      const criado = await criar({ observacao: 'antiga' });

      const resposta = await chamarApi(UM_LEMBRETE, 'PATCH', {
        token,
        parametros: { id: String(criado.id) },
        corpo: { versaoEsperada: 1, observacao: null, ...OUTRO_FUTURO },
      });

      expect(lerLembrete(resposta.corpo.dados)).toEqual(
        expect.objectContaining({
          observacao: null,
          lembreteData: '2099-02-03',
          lembreteHora: '08:30',
          lembreteEm: '2099-02-03T11:30:00.000Z',
          situacao: 'pendente',
        }),
      );
    });

    it('deve trocar só a hora, mantendo a data', async () => {
      const criado = await criar();

      const resposta = await chamarApi(UM_LEMBRETE, 'PATCH', {
        token,
        parametros: { id: String(criado.id) },
        corpo: { versaoEsperada: 1, lembreteHora: '15:45' },
      });

      expect(lerLembrete(resposta.corpo.dados)).toEqual(
        expect.objectContaining({
          lembreteData: '2099-01-01',
          lembreteHora: '15:45',
        }),
      );
    });

    it('deve exigir novo horário futuro para reaproveitar um lembrete já disparado', async () => {
      const id = criarDisparado('Disparado');

      const soTitulo = await chamarApi(UM_LEMBRETE, 'PATCH', {
        token,
        parametros: { id: String(id) },
        corpo: { versaoEsperada: 1, titulo: 'Remarcado' },
      });
      const remarcado = await chamarApi(UM_LEMBRETE, 'PATCH', {
        token,
        parametros: { id: String(id) },
        corpo: { versaoEsperada: 1, titulo: 'Remarcado', ...FUTURO },
      });

      expect(soTitulo.status).toBe(400);
      expect(soTitulo.corpo.erro?.codigo).toBe('lembrete-no-passado');
      expect(lerLembrete(remarcado.corpo.dados)).toEqual(
        expect.objectContaining({
          situacao: 'pendente',
          disparadoEm: null,
          dispensadoEm: null,
          lembreteEm: FUTURO_UTC,
        }),
      );
    });

    it('deve recusar versão antiga sem gravar, e corpo sem nenhum campo', async () => {
      const criado = await criar();

      const antiga = await chamarApi(UM_LEMBRETE, 'PATCH', {
        token,
        parametros: { id: String(criado.id) },
        corpo: { versaoEsperada: 7, titulo: 'Atrasado' },
      });
      const vazio = await chamarApi(UM_LEMBRETE, 'PATCH', {
        token,
        parametros: { id: String(criado.id) },
        corpo: { versaoEsperada: 1 },
      });
      const lido = await chamarApi(UM_LEMBRETE, 'GET', {
        token,
        parametros: { id: String(criado.id) },
      });

      expect(antiga.status).toBe(409);
      expect(antiga.corpo.erro?.codigo).toBe('conflito-de-versao');
      expect(vazio.status).toBe(400);
      expect(lerLembrete(lido.corpo.dados)).toEqual(criado);
    });

    it('deve responder 404 ao atualizar lembrete inexistente', async () => {
      const resposta = await chamarApi(UM_LEMBRETE, 'PATCH', {
        token,
        parametros: { id: INEXISTENTE },
        corpo: { versaoEsperada: 1, titulo: 'Fantasma' },
      });

      expect(resposta.status).toBe(404);
    });
  });

  describe('desativar e reativar', () => {
    it('deve desativar e reativar um lembrete futuro', async () => {
      const criado = await criar();
      const parametros = { id: String(criado.id) };

      const desativado = await chamarApi(DESATIVAR, 'POST', {
        token,
        parametros,
        corpo: { versaoEsperada: criado.versao },
      });
      const reativado = await chamarApi(REATIVAR, 'POST', {
        token,
        parametros,
        corpo: { versaoEsperada: criado.versao + 1 },
      });

      expect(lerLembrete(desativado.corpo.dados)).toEqual(
        expect.objectContaining({ situacao: 'cancelado', versao: 2 }),
      );
      expect(lerLembrete(reativado.corpo.dados)).toEqual(
        expect.objectContaining({ situacao: 'pendente', versao: 3 }),
      );
    });

    it('não deve desativar um lembrete que já disparou', async () => {
      const id = criarDisparado('Disparado');

      const resposta = await chamarApi(DESATIVAR, 'POST', {
        token,
        parametros: { id: String(id) },
        corpo: { versaoEsperada: 1 },
      });

      expect(resposta.status).toBe(409);
      expect(resposta.corpo.erro?.codigo).toBe('lembrete-ja-disparado');
    });

    it('não deve reativar um lembrete cujo horário já passou', async () => {
      const { lembreteId } = criarLembreteAvulso(
        banco,
        { titulo: 'Vencido', observacao: null, ...OUTRO_FUTURO },
        new Date('2099-01-01T00:00:00Z'),
      );
      await chamarApi(DESATIVAR, 'POST', {
        token,
        parametros: { id: String(lembreteId) },
        corpo: { versaoEsperada: 1 },
      });

      // A API só cria lembretes futuros: o horário vai para o passado direto
      // na tabela, como se o tempo tivesse passado depois de desativar.
      banco.$client
        .prepare(
          "UPDATE lembretes_avulsos SET lembrete_em = '2020-01-01T13:00:00.000Z' WHERE id = ?",
        )
        .run(lembreteId);
      const resposta = await chamarApi(REATIVAR, 'POST', {
        token,
        parametros: { id: String(lembreteId) },
        corpo: { versaoEsperada: 2 },
      });

      expect(resposta.status).toBe(409);
      expect(resposta.corpo.erro?.codigo).toBe('lembrete-vencido');
    });

    it('deve exigir versaoEsperada e recusar versão antiga', async () => {
      const criado = await criar();
      const parametros = { id: String(criado.id) };

      const semVersao = await chamarApi(DESATIVAR, 'POST', {
        token,
        parametros,
        corpo: {},
      });
      const antiga = await chamarApi(DESATIVAR, 'POST', {
        token,
        parametros,
        corpo: { versaoEsperada: 9 },
      });

      expect(semVersao.status).toBe(400);
      expect(antiga.status).toBe(409);
      expect(antiga.corpo.erro?.codigo).toBe('conflito-de-versao');
    });
  });

  describe('excluir', () => {
    it('deve excluir com a versão informada na consulta', async () => {
      const criado = await criar();
      const parametros = { id: String(criado.id) };

      const resposta = await chamarApi(UM_LEMBRETE, 'DELETE', {
        token,
        parametros,
        consulta: `?versaoEsperada=${criado.versao}`,
      });
      const depois = await chamarApi(UM_LEMBRETE, 'GET', { token, parametros });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo.dados).toEqual({ lembreteId: criado.id });
      expect(depois.status).toBe(404);
      expect(contarLinhas(banco, 'lembretes_avulsos')).toBe(0);
    });

    it('deve recusar versão antiga, versão ausente e parâmetro desconhecido sem apagar', async () => {
      const criado = await criar();
      const parametros = { id: String(criado.id) };

      const antiga = await chamarApi(UM_LEMBRETE, 'DELETE', {
        token,
        parametros,
        consulta: '?versaoEsperada=5',
      });
      const ausente = await chamarApi(UM_LEMBRETE, 'DELETE', {
        token,
        parametros,
      });
      const desconhecido = await chamarApi(UM_LEMBRETE, 'DELETE', {
        token,
        parametros,
        consulta: '?versaoEsperada=1&forcar=1',
      });

      expect(antiga.status).toBe(409);
      expect(ausente.status).toBe(400);
      expect(desconhecido.corpo.erro?.codigo).toBe('parametro-desconhecido');
      expect(contarLinhas(banco, 'lembretes_avulsos')).toBe(1);
    });
  });

  describe('permissões', () => {
    it('deve liberar a leitura só com atividades:ler e bloquear a escrita', async () => {
      const criado = await criar();
      const leitor = criarTokenApiDeTeste(banco, ['atividades:ler']);
      const parametros = { id: String(criado.id) };

      const lista = await chamarApi(LEMBRETES, 'GET', { token: leitor });
      const lido = await chamarApi(UM_LEMBRETE, 'GET', {
        token: leitor,
        parametros,
      });
      const tentativas = [
        await chamarApi(LEMBRETES, 'POST', {
          token: leitor,
          corpo: { titulo: 'X', ...FUTURO },
        }),
        await chamarApi(UM_LEMBRETE, 'PATCH', {
          token: leitor,
          parametros,
          corpo: { versaoEsperada: 1, titulo: 'X' },
        }),
        await chamarApi(DESATIVAR, 'POST', {
          token: leitor,
          parametros,
          corpo: { versaoEsperada: 1 },
        }),
        await chamarApi(REATIVAR, 'POST', {
          token: leitor,
          parametros,
          corpo: { versaoEsperada: 1 },
        }),
        await chamarApi(UM_LEMBRETE, 'DELETE', {
          token: leitor,
          parametros,
          consulta: '?versaoEsperada=1',
        }),
      ];

      expect(lista.status).toBe(200);
      expect(lido.status).toBe(200);
      expect(tentativas.map((resposta) => resposta.status)).toEqual([
        403, 403, 403, 403, 403,
      ]);
      expect(
        tentativas.every(
          (resposta) =>
            resposta.corpo.erro?.codigo === 'permissao-insuficiente',
        ),
      ).toBe(true);
      expect(contarLinhas(banco, 'lembretes_avulsos')).toBe(1);
    });

    it('não deve servir lembretes a quem só tem permissões do board', async () => {
      const soBoard = criarTokenApiDeTeste(banco, [
        'board:ler',
        'board:escrever',
      ]);

      const lista = await chamarApi(LEMBRETES, 'GET', { token: soBoard });
      const criacao = await chamarApi(LEMBRETES, 'POST', {
        token: soBoard,
        corpo: { titulo: 'X', ...FUTURO },
      });

      expect(lista.status).toBe(403);
      expect(criacao.status).toBe(403);
      expect(contarLinhas(banco, 'lembretes_avulsos')).toBe(0);
    });

    it('deve responder 405 em métodos não implementados', async () => {
      const resposta = await chamarApi(LEMBRETES, 'DELETE', { token });

      expect(resposta.status).toBe(405);
      expect(resposta.cabecalhos.get('allow')).toBe('GET, POST');
    });
  });
});
