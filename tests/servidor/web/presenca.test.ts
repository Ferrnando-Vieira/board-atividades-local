jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((destino: string) => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
jest.mock('next/server', () => ({
  connection: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/servidor/web/bancoAplicacao', () => ({
  CODIGO_BANCO_AUSENTE: 'banco-ausente',
  obterBancoAplicacao: jest.fn(),
}));

import { POST as sinalCompartilhado } from '@/app/compartilhado/[token]/presenca/route';
import { POST as sinalProprietario } from '@/app/presenca/route';
import { criarSessao } from '@/servidor/administracao/sessoes';
import { fecharBanco, type BancoDados } from '@/servidor/banco/conexao';
import { ID_REGISTRO_UNICO } from '@/servidor/banco/esquema';
import { revogarLinkCompartilhamento } from '@/servidor/compartilhamento/linksServico';
import {
  criarEstadoPresenca,
  obterEstadoPresenca,
  type ResultadoPresenca,
} from '@/servidor/presenca/presencaBoard';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { simularCookieSessao } from '@/tests/suporte/acoesServidor';
import { criarBancoInicializado } from '@/tests/suporte/bancoTeste';
import {
  cadastrarAdministrador,
  criarLinkDeTeste,
} from '@/tests/suporte/fabricasCompartilhamento';

const ID_VISITANTE = 'abcdefghijklmnop1234';
const ID_PROPRIETARIO = 'proprietario-0000000000';

function montarRequisicao(corpo: unknown, tipo = 'application/json'): Request {
  return new Request('http://127.0.0.1/presenca', {
    method: 'POST',
    headers: { 'Content-Type': tipo },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });
}

function contextoRota(token: string) {
  return { params: Promise.resolve({ token }) } as never;
}

describe('rotas de presença', () => {
  let banco: BancoDados;

  beforeEach(() => {
    banco = criarBancoInicializado();
    cadastrarAdministrador(banco);
    jest.mocked(obterBancoAplicacao).mockReturnValue(banco);
    simularCookieSessao(undefined);
    const estado = obterEstadoPresenca();
    const limpo = criarEstadoPresenca();
    estado.visitantes = limpo.visitantes;
    estado.atribuicoes = limpo.atribuicoes;
  });

  afterEach(() => {
    fecharBanco(banco);
  });

  it('deve recusar o proprietário sem sessão com 401, sem redirecionar', async () => {
    const resposta = await sinalProprietario(
      montarRequisicao({ visitanteId: ID_PROPRIETARIO }),
    );

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get('cache-control')).toBe('no-store');
  });

  it('deve listar o visitante do link como animal e o proprietário como proprietário', async () => {
    const { token } = criarLinkDeTeste(banco, { modalidade: 'completo' });
    simularCookieSessao(
      criarSessao(banco, ID_REGISTRO_UNICO, new Date()).token,
    );

    await sinalProprietario(montarRequisicao({ visitanteId: ID_PROPRIETARIO }));
    const resposta = await sinalCompartilhado(
      montarRequisicao({ visitanteId: ID_VISITANTE }),
      contextoRota(token),
    );
    const dados = (await resposta.json()) as ResultadoPresenca;

    expect(resposta.status).toBe(200);
    expect(dados.voce).toEqual(
      expect.objectContaining({ tipo: 'link', animal: expect.any(String) }),
    );
    expect(dados.presentes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: 'proprietario', animal: null }),
      ]),
    );
    expect(JSON.stringify(dados)).not.toContain(ID_PROPRIETARIO);
  });

  it('deve responder 404 para link revogado ou inventado', async () => {
    const link = criarLinkDeTeste(banco, { modalidade: 'completo' });
    revogarLinkCompartilhamento(banco, { linkId: link.linkId });

    const revogado = await sinalCompartilhado(
      montarRequisicao({ visitanteId: ID_VISITANTE }),
      contextoRota(link.token),
    );
    const inventado = await sinalCompartilhado(
      montarRequisicao({ visitanteId: ID_VISITANTE }),
      contextoRota('x'.repeat(43)),
    );

    expect(revogado.status).toBe(404);
    expect(inventado.status).toBe(404);
    expect(obterEstadoPresenca().visitantes.size).toBe(0);
  });

  it.each([
    [
      'tipo de conteúdo que não é JSON',
      { visitanteId: ID_VISITANTE },
      'text/plain',
      415,
    ],
    ['JSON inválido', '{', 'application/json', 400],
    ['identificador curto', { visitanteId: 'abc' }, 'application/json', 400],
    [
      'campo a mais',
      { visitanteId: ID_VISITANTE, animal: 'onca' },
      'application/json',
      400,
    ],
    [
      'corpo grande demais',
      { visitanteId: ID_VISITANTE, x: 'a'.repeat(600) },
      'application/json',
      413,
    ],
  ])('deve recusar %s', async (_caso, corpo, tipo, status) => {
    const { token } = criarLinkDeTeste(banco, { modalidade: 'completo' });

    const resposta = await sinalCompartilhado(
      montarRequisicao(corpo, tipo),
      contextoRota(token),
    );

    expect(resposta.status).toBe(status);
  });

  it('deve tirar da lista quem avisa a saída', async () => {
    const { token } = criarLinkDeTeste(banco, { modalidade: 'completo' });
    await sinalCompartilhado(
      montarRequisicao({ visitanteId: ID_VISITANTE }),
      contextoRota(token),
    );

    const saida = await sinalCompartilhado(
      montarRequisicao({ visitanteId: ID_VISITANTE, saindo: true }),
      contextoRota(token),
    );

    expect(saida.status).toBe(204);
    expect(obterEstadoPresenca().visitantes.size).toBe(0);
  });
});
