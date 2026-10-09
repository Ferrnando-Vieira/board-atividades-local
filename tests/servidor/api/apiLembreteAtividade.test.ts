jest.mock('@/servidor/web/bancoAplicacao', () => ({
  CODIGO_BANCO_AUSENTE: 'banco-ausente',
  obterBancoAplicacao: jest.fn(),
}));

import {
  esquemaAtividadeApi,
  esquemaHistoricoApi,
  esquemaListaSolicitantesApi,
  type AtividadeApi,
} from '@/servidor/api/esquemasApi';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import { chamarApi, MODULOS_ROTA_API } from '@/tests/suporte/clienteApi';
import {
  cadastrarAdministrador,
  criarTokenApiDeTeste,
} from '@/tests/suporte/fabricasCompartilhamento';

function exigirRota(caminho: string) {
  const modulo = MODULOS_ROTA_API[caminho];
  if (!modulo) {
    throw new Error(`Rota ${caminho} ausente no mapa de teste.`);
  }
  return modulo;
}

const ATIVIDADES = exigirRota('/api/v1/atividades');
const ATIVIDADE = exigirRota('/api/v1/atividades/{id}');
const HISTORICO = exigirRota('/api/v1/atividades/{id}/historico');
const LEMBRETE = exigirRota('/api/v1/atividades/{id}/lembrete');
const DESATIVAR = exigirRota('/api/v1/atividades/{id}/lembrete/desativar');
const REATIVAR = exigirRota('/api/v1/atividades/{id}/lembrete/reativar');
const SOLICITANTES = exigirRota('/api/v1/solicitantes');
const SOLICITANTE_PADRAO = exigirRota('/api/v1/solicitantes/padrao');

const DATA_FUTURA = '2099-01-10';
const DATA_PASSADA = '2020-01-10';

describe('API: lembrete da atividade, histórico e solicitante padrão', () => {
  let banco: BancoDados;
  let token: string;
  let atividade: AtividadeApi;

  beforeEach(async () => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    token = criarTokenApiDeTeste(banco, [
      'board:ler',
      'board:escrever',
      'atividades:ler',
      'atividades:escrever',
    ]);
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
    const criada = await chamarApi(ATIVIDADES, 'POST', {
      token,
      corpo: { titulo: 'Fechar faturamento' },
    });
    atividade = esquemaAtividadeApi.parse(criada.corpo.dados);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  const parametros = () => ({ id: String(atividade.id) });

  async function definirLembrete(data = DATA_FUTURA) {
    return chamarApi(LEMBRETE, 'PUT', {
      token,
      corpo: {
        versaoEsperada: atividade.versao,
        lembreteData: data,
        lembreteHora: '09:00',
      },
      parametros: parametros(),
    });
  }

  describe('lembrete', () => {
    it('deve definir, desativar, reativar e excluir avançando a versão', async () => {
      const definido = esquemaAtividadeApi.parse(
        (await definirLembrete()).corpo.dados,
      );
      const desativado = esquemaAtividadeApi.parse(
        (
          await chamarApi(DESATIVAR, 'POST', {
            token,
            corpo: { versaoEsperada: definido.versao },
            parametros: parametros(),
          })
        ).corpo.dados,
      );
      const reativado = esquemaAtividadeApi.parse(
        (
          await chamarApi(REATIVAR, 'POST', {
            token,
            corpo: { versaoEsperada: desativado.versao },
            parametros: parametros(),
          })
        ).corpo.dados,
      );
      const excluido = esquemaAtividadeApi.parse(
        (
          await chamarApi(LEMBRETE, 'DELETE', {
            token,
            consulta: `?versaoEsperada=${reativado.versao}`,
            parametros: parametros(),
          })
        ).corpo.dados,
      );

      expect(definido.lembreteSituacao).toBe('pendente');
      expect(definido.lembreteEm).not.toBeNull();
      expect(desativado.lembreteSituacao).toBe('cancelado');
      expect(reativado.lembreteSituacao).toBe('pendente');
      expect(excluido.lembreteEm).toBeNull();
      expect(excluido.lembreteSituacao).toBeNull();
      expect(excluido.versao).toBeGreaterThan(atividade.versao);
    });

    it('deve recusar horário passado e versão vencida', async () => {
      const passado = await definirLembrete(DATA_PASSADA);
      await definirLembrete();
      const vencida = await definirLembrete();

      expect(passado.status).toBe(400);
      expect(passado.corpo.erro?.codigo).toBe('lembrete-no-passado');
      expect(vencida.status).toBe(409);
      expect(vencida.corpo.erro?.codigo).toBe('conflito-de-versao');
    });

    it('deve exigir atividades:escrever', async () => {
      const leitura = criarTokenApiDeTeste(banco, ['atividades:ler']);

      const resposta = await chamarApi(LEMBRETE, 'PUT', {
        token: leitura,
        corpo: {
          versaoEsperada: atividade.versao,
          lembreteData: DATA_FUTURA,
          lembreteHora: '09:00',
        },
        parametros: parametros(),
      });

      expect(resposta.status).toBe(403);
    });
  });

  describe('histórico', () => {
    it('deve listar as alterações feitas pela API, mais recentes primeiro', async () => {
      await chamarApi(ATIVIDADE, 'PATCH', {
        token,
        corpo: { versaoEsperada: atividade.versao, prioridade: 1 },
        parametros: parametros(),
      });

      const resposta = await chamarApi(HISTORICO, 'GET', {
        token,
        parametros: parametros(),
      });

      const historico = esquemaHistoricoApi.parse(resposta.corpo.dados);
      expect(historico.total).toBe(2);
      expect(historico.eventos.map((evento) => evento.tipo)).toEqual([
        'edicao',
        'criacao',
      ]);
      expect(historico.eventos[0]).toEqual(
        expect.objectContaining({
          origem: 'api',
          autor: 'Agente de teste',
          alteracoes: [{ campo: 'prioridade', antes: '5', depois: '1' }],
        }),
      );
    });

    it('deve responder 404 para atividade inexistente', async () => {
      const resposta = await chamarApi(HISTORICO, 'GET', {
        token,
        parametros: { id: '99999' },
      });

      expect(resposta.status).toBe(404);
    });
  });

  describe('solicitante padrão', () => {
    it('deve trocar o padrão do board, cadastrando o nome novo', async () => {
      const resposta = await chamarApi(SOLICITANTE_PADRAO, 'PUT', {
        token,
        corpo: { nome: 'Financeiro' },
      });
      const lista = await chamarApi(SOLICITANTES, 'GET', { token });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo.dados).toEqual(
        expect.objectContaining({ nome: 'Financeiro', criado: true }),
      );
      expect(
        esquemaListaSolicitantesApi
          .parse(lista.corpo.dados)
          .filter((solicitante) => solicitante.padrao)
          .map((solicitante) => solicitante.nome),
      ).toEqual(['Financeiro']);
    });

    it('deve exigir board:escrever', async () => {
      const leitura = criarTokenApiDeTeste(banco, ['board:ler']);

      const resposta = await chamarApi(SOLICITANTE_PADRAO, 'PUT', {
        token: leitura,
        corpo: { nome: 'Financeiro' },
      });

      expect(resposta.status).toBe(403);
    });
  });
});
