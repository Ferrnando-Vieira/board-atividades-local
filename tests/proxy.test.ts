import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { SESSAO_ADMINISTRATIVA } from '@/config/constantesSeguranca';
import { config, proxy } from '@/proxy';

const URL_BOARD = 'http://127.0.0.1:3000/';
const TOKEN = 'token-da-sessao';
const MILISSEGUNDOS_POR_DIA = 86_400_000;

function requisitar(metodo: string, comSessao: boolean): NextRequest {
  return new NextRequest(URL_BOARD, {
    method: metodo,
    headers: comSessao
      ? { cookie: `${SESSAO_ADMINISTRATIVA.NOME_COOKIE}=${TOKEN}` }
      : {},
  });
}

function cookieGravado(requisicao: NextRequest) {
  return proxy(requisicao).cookies.get(SESSAO_ADMINISTRATIVA.NOME_COOKIE);
}

describe('proxy', () => {
  it('deve regravar o cookie da sessão com a validade renovada numa navegação', () => {
    const antes = Date.now();

    const cookie = cookieGravado(requisitar('GET', true));

    expect(cookie).toMatchObject({
      value: TOKEN,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    });
    const diasDeValidade =
      (new Date(cookie?.expires ?? 0).getTime() - antes) /
      MILISSEGUNDOS_POR_DIA;
    expect(diasDeValidade).toBeCloseTo(SESSAO_ADMINISTRATIVA.DURACAO_DIAS, 1);
  });

  it('não deve criar cookie para quem não tem sessão', () => {
    expect(cookieGravado(requisitar('GET', false))).toBeUndefined();
  });

  it('não deve mexer no cookie num POST, onde a Server Action entra ou sai', () => {
    expect(cookieGravado(requisitar('POST', true))).toBeUndefined();
  });

  it.each(['/', '/aparencia', '/atividades/12', '/compartilhado/abc'])(
    'deve rodar nas páginas (%s)',
    (caminho) => {
      expect(unstable_doesMiddlewareMatch({ config, url: caminho })).toBe(true);
    },
  );

  it.each(['/api/v1/board', '/_next/static/chunks/app.js', '/favicon.ico'])(
    'deve deixar de fora a API e os arquivos estáticos (%s)',
    (caminho) => {
      expect(unstable_doesMiddlewareMatch({ config, url: caminho })).toBe(
        false,
      );
    },
  );
});
