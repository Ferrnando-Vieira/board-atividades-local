jest.mock('@/servidor/web/bancoAplicacao', () => ({
  CODIGO_BANCO_AUSENTE: 'banco-ausente',
  obterBancoAplicacao: jest.fn(),
}));

import { LIMITES_CORPO_API } from '@/servidor/api/limitesApi';
import { CATALOGO_API } from '@/servidor/api/catalogoApi';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import {
  criarTokenApi,
  revogarTokenApi,
} from '@/servidor/tokensApi/tokensApiServico';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { ErroApp } from '@/util/ErroApp';
import {
  contarLinhas,
  criarBancoInicializado,
} from '@/tests/suporte/bancoTeste';
import {
  chamarApi,
  MODULO_ROTA_INEXISTENTE,
  MODULOS_ROTA_API,
} from '@/tests/suporte/clienteApi';
import {
  cadastrarAdministrador,
  criarLinkDeTeste,
  criarTokenApiDeTeste,
} from '@/tests/suporte/fabricasCompartilhamento';

const rotas = MODULOS_ROTA_API;

function exigirRota(caminho: string) {
  const modulo = rotas[caminho];
  if (!modulo) {
    throw new Error(`Rota ${caminho} ausente no mapa de teste.`);
  }
  return modulo;
}

const ATIVIDADES = exigirRota('/api/v1/atividades');
const INDICE = exigirRota('/api/v1');
const TAGS = exigirRota('/api/v1/tags');

describe('API: autenticação e contrato de erros', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  describe('autenticação', () => {
    it('deve responder 401 com desafio Bearer quando falta o token', async () => {
      const resposta = await chamarApi(INDICE, 'GET');

      expect(resposta.status).toBe(401);
      expect(resposta.corpo.erro?.codigo).toBe('token-ausente');
      expect(resposta.cabecalhos.get('www-authenticate')).toBe(
        'Bearer realm="board-atividades"',
      );
      expect(resposta.cabecalhos.get('content-type')).toContain(
        'application/json',
      );
    });

    it('deve recusar outro esquema de autorização', async () => {
      const resposta = await chamarApi(INDICE, 'GET', {
        cabecalhoAutorizacao: 'Basic aGlyYTpzZW5oYQ==',
      });

      expect(resposta.status).toBe(401);
      expect(resposta.corpo.erro?.codigo).toBe('token-ausente');
    });

    it('deve recusar token desconhecido com invalid_token', async () => {
      const resposta = await chamarApi(INDICE, 'GET', {
        token: `bat_${'x'.repeat(43)}`,
      });

      expect(resposta.status).toBe(401);
      expect(resposta.corpo.erro?.codigo).toBe('token-invalido');
      expect(resposta.cabecalhos.get('www-authenticate')).toContain(
        'error="invalid_token"',
      );
    });

    it('deve recusar o token de um link de compartilhamento', async () => {
      const { token } = criarLinkDeTeste(banco, { modalidade: 'completo' });

      const resposta = await chamarApi(INDICE, 'GET', { token });

      expect(resposta.status).toBe(401);
    });

    it('deve recusar token revogado já na requisição seguinte', async () => {
      const { token, tokenId } = criarTokenApi(banco, {
        nome: 'Kiro',
        permissoes: ['board:ler'],
        validadeDias: null,
      });
      const antes = await chamarApi(INDICE, 'GET', { token });

      revogarTokenApi(banco, { tokenId });
      const depois = await chamarApi(INDICE, 'GET', { token });

      expect(antes.status).toBe(200);
      expect(depois.status).toBe(401);
      expect(depois.corpo.erro?.codigo).toBe('token-invalido');
    });

    it('deve recusar token expirado', async () => {
      const token = criarTokenApi(
        banco,
        { nome: 'Antigo', permissoes: ['board:ler'], validadeDias: 1 },
        new Date('2026-01-01T00:00:00.000Z'),
      ).token;

      const resposta = await chamarApi(INDICE, 'GET', { token });

      expect(resposta.status).toBe(401);
    });

    it('deve responder 503 enquanto a instalação não estiver pronta', async () => {
      const bancoSemAdministrador = criarBancoInicializado();
      const token = criarTokenApiDeTeste(bancoSemAdministrador, ['board:ler']);
      jest.mocked(obterBancoAplicacao).mockReturnValue(bancoSemAdministrador);

      const resposta = await chamarApi(INDICE, 'GET', { token });
      fecharBanco(bancoSemAdministrador);

      expect(resposta.status).toBe(503);
      expect(resposta.corpo.erro?.codigo).toBe('instalacao-incompleta');
    });

    it('deve responder 503 quando o banco ainda não existe', async () => {
      jest.mocked(obterBancoAplicacao).mockImplementation(() => {
        throw new ErroApp('ausente', { codigo: 'banco-ausente' });
      });

      const resposta = await chamarApi(INDICE, 'GET', { token: 'qualquer' });

      expect(resposta.status).toBe(503);
    });
  });

  describe('permissões', () => {
    it('deve responder 403 quando falta a permissão do endpoint', async () => {
      const token = criarTokenApiDeTeste(banco, ['board:ler']);

      const resposta = await chamarApi(ATIVIDADES, 'GET', { token });

      expect(resposta.status).toBe(403);
      expect(resposta.corpo.erro).toEqual(
        expect.objectContaining({ codigo: 'permissao-insuficiente' }),
      );
      expect(resposta.corpo.erro?.mensagem).toContain('atividades:ler');
      expect(resposta.cabecalhos.get('www-authenticate')).toContain(
        'insufficient_scope',
      );
    });

    it('não deve deixar atividades:escrever gerenciar tags', async () => {
      const token = criarTokenApiDeTeste(banco, [
        'atividades:ler',
        'atividades:escrever',
      ]);

      const resposta = await chamarApi(TAGS, 'POST', {
        token,
        corpo: { nome: 'Invasora' },
      });

      expect(resposta.status).toBe(403);
      expect(contarLinhas(banco, 'tags')).toBe(0);
    });

    it('não deve deixar leitura escrever atividades', async () => {
      const token = criarTokenApiDeTeste(banco, ['atividades:ler']);

      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: 'Sem permissão' },
      });

      expect(resposta.status).toBe(403);
      expect(contarLinhas(banco, 'atividades')).toBe(0);
    });
  });

  describe('corpo e parâmetros', () => {
    let token: string;

    beforeEach(() => {
      token = criarTokenApiDeTeste(banco, [
        'atividades:ler',
        'atividades:escrever',
      ]);
    });

    it('deve recusar JSON malformado com 400', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpoBruto: '{"titulo": ',
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.codigo).toBe('json-invalido');
    });

    it('deve recusar corpo vazio com 400', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpoBruto: '',
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.codigo).toBe('json-invalido');
    });

    it('deve recusar tipo de conteúdo diferente de JSON com 415', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpoBruto: 'titulo=x',
        tipoConteudo: 'application/x-www-form-urlencoded',
      });

      expect(resposta.status).toBe(415);
      expect(resposta.corpo.erro?.codigo).toBe('tipo-conteudo-nao-suportado');
    });

    it('deve recusar corpo acima do limite com 413', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: 'x'.repeat(LIMITES_CORPO_API.BYTES_MAXIMOS) },
      });

      expect(resposta.status).toBe(413);
      expect(contarLinhas(banco, 'atividades')).toBe(0);
    });

    it('deve recusar campo desconhecido no corpo', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: 'Válida', dono: 'outra pessoa' },
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.codigo).toBe('dados-invalidos');
      expect(resposta.corpo.erro?.gerais?.join(' ')).toContain('dono');
    });

    it('deve recusar tipo JSON errado com o campo indicado', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'POST', {
        token,
        corpo: { titulo: 'Válida', prioridade: '2' },
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.campos?.prioridade).toEqual([
        expect.stringContaining('número'),
      ]);
    });

    it('deve recusar parâmetro de consulta desconhecido', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'GET', {
        token,
        consulta: '?tags=Faturas',
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.codigo).toBe('parametro-desconhecido');
      expect(resposta.corpo.erro?.mensagem).toContain('tags');
    });

    it('deve recusar parâmetro único repetido', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'GET', {
        token,
        consulta: '?busca=a&busca=b',
      });

      expect(resposta.status).toBe(400);
    });

    it('deve recusar identificador de status malformado na consulta', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'GET', {
        token,
        consulta: '?status=1e3',
      });

      expect(resposta.status).toBe(400);
      expect(resposta.corpo.erro?.campos).toHaveProperty('status');
    });
  });

  describe('rotas e métodos', () => {
    it('deve responder 405 em JSON, com Allow, para método não implementado', async () => {
      const token = criarTokenApiDeTeste(banco, ['board:ler']);

      const resposta = await chamarApi(ATIVIDADES, 'PUT', {
        token,
        corpo: {},
      });

      expect(resposta.status).toBe(405);
      expect(resposta.corpo.erro?.codigo).toBe('metodo-nao-permitido');
      expect(resposta.cabecalhos.get('allow')).toBe('GET, POST');
    });

    it('deve exigir token antes de responder 405', async () => {
      const resposta = await chamarApi(ATIVIDADES, 'DELETE');

      expect(resposta.status).toBe(401);
    });

    it('deve responder 404 em JSON para caminho inexistente com token válido', async () => {
      const token = criarTokenApiDeTeste(banco, ['board:ler']);

      const resposta = await chamarApi(MODULO_ROTA_INEXISTENTE, 'GET', {
        token,
        parametros: { caminho: ['v1', 'nada'] },
      });

      expect(resposta.status).toBe(404);
      expect(resposta.corpo.erro?.codigo).toBe('rota-inexistente');
    });

    it('deve exigir token também no caminho inexistente', async () => {
      const resposta = await chamarApi(MODULO_ROTA_INEXISTENTE, 'POST', {
        corpo: {},
      });

      expect(resposta.status).toBe(401);
    });
  });

  describe('catálogo', () => {
    it.each(
      CATALOGO_API.map((endpoint) => [endpoint.metodo, endpoint.caminho]),
    )(
      '%s %s deve existir no route.ts e exigir token',
      async (metodo, caminho) => {
        const modulo = exigirRota(caminho);

        const resposta = await chamarApi(modulo, metodo, {
          parametros: { id: '1' },
        });

        expect(resposta.status).toBe(401);
      },
    );

    it('deve listar no índice o catálogo e as permissões do token, sem hashes', async () => {
      const token = criarTokenApiDeTeste(banco, [
        'board:ler',
        'atividades:ler',
      ]);

      const resposta = await chamarApi(INDICE, 'GET', { token });

      expect(resposta.status).toBe(200);
      expect(resposta.corpo.dados).toEqual(
        expect.objectContaining({
          versao: 'v1',
          token: expect.objectContaining({
            nome: 'Agente de teste',
            permissoes: ['board:ler', 'atividades:ler'],
          }),
          endpoints: expect.arrayContaining([
            expect.objectContaining({
              metodo: 'POST',
              caminho: '/api/v1/atividades',
              permissoes: ['atividades:escrever'],
            }),
          ]),
        }),
      );
      expect(
        (resposta.corpo.dados as { endpoints: unknown[] }).endpoints,
      ).toHaveLength(CATALOGO_API.length);
      expect(JSON.stringify(resposta.corpo)).not.toContain(token);
      expect(JSON.stringify(resposta.corpo)).not.toMatch(/hash/i);
      expect(resposta.cabecalhos.get('cache-control')).toBe('no-store');
    });
  });
});
