import { NextResponse, type NextRequest } from 'next/server';
import { SESSAO_ADMINISTRATIVA } from '@/config/constantesSeguranca';
import { calcularExpiracaoSessao } from '@/servidor/administracao/expiracaoSessao';
import { montarOpcoesCookieSessao } from '@/servidor/web/opcoesCookieSessao';

// Empurra a validade do cookie de sessão a cada navegação; o banco faz o
// mesmo em validarSessao. Assim a sessão só acaba ao sair ou depois de muito
// tempo sem uso. O cookie é regravado sem consultar o banco: um token
// revogado continua recusado pelo servidor. Só em GET, porque num POST a
// Server Action pode gravar ou apagar o cookie (entrar, sair) e as duas
// escritas disputariam a mesma resposta.
export function proxy(requisicao: NextRequest): NextResponse {
  const resposta = NextResponse.next();
  const token = requisicao.cookies.get(
    SESSAO_ADMINISTRATIVA.NOME_COOKIE,
  )?.value;
  if (requisicao.method !== 'GET' || !token) {
    return resposta;
  }
  resposta.cookies.set(
    SESSAO_ADMINISTRATIVA.NOME_COOKIE,
    token,
    montarOpcoesCookieSessao(calcularExpiracaoSessao(new Date())),
  );
  return resposta;
}

// Arquivos estáticos e a API (autenticada por token Bearer, não por cookie)
// ficam de fora.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
