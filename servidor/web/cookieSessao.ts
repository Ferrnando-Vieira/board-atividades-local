import 'server-only';
import { cookies } from 'next/headers';
import { SESSAO_ADMINISTRATIVA } from '@/config/constantesSeguranca';
import { montarOpcoesCookieSessao } from '@/servidor/web/opcoesCookieSessao';

export async function lerTokenSessao(): Promise<string | undefined> {
  const armazenamento = await cookies();
  return armazenamento.get(SESSAO_ADMINISTRATIVA.NOME_COOKIE)?.value;
}

export async function gravarCookieSessao(
  token: string,
  expiraEm: string,
): Promise<void> {
  const armazenamento = await cookies();
  armazenamento.set(
    SESSAO_ADMINISTRATIVA.NOME_COOKIE,
    token,
    montarOpcoesCookieSessao(expiraEm),
  );
}

export async function removerCookieSessao(): Promise<void> {
  const armazenamento = await cookies();
  armazenamento.delete(SESSAO_ADMINISTRATIVA.NOME_COOKIE);
}
