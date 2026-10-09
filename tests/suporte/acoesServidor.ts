import { cookies } from 'next/headers';
import { SESSAO_ADMINISTRATIVA } from '@/config/constantesSeguranca';

// Usado por arquivos de teste que já simularam `next/headers` com
// jest.mock: o `cookies` importado aqui é o mesmo jest.fn do teste.
type ArmazenamentoCookies = Awaited<ReturnType<typeof cookies>>;

export const CAMPO_CREDENCIAL = 'tokenCompartilhamento';
export const REDIRECIONA_PARA_ENTRADA = 'NEXT_REDIRECT:/entrar';
export const REDIRECIONA_PARA_INDISPONIVEL = 'NEXT_REDIRECT:/compartilhado';

export function simularCookieSessao(token: string | undefined): void {
  const armazenamento = {
    get: (nome: string) =>
      token !== undefined && nome === SESSAO_ADMINISTRATIVA.NOME_COOKIE
        ? { name: nome, value: token }
        : undefined,
  };
  jest
    .mocked(cookies)
    .mockResolvedValue(armazenamento as unknown as ArmazenamentoCookies);
}

export function montarFormularioTeste(
  campos: Record<string, string | string[] | Blob>,
): FormData {
  const formulario = new FormData();
  for (const [campo, valor] of Object.entries(campos)) {
    if (valor instanceof Blob) {
      formulario.append(campo, valor);
      continue;
    }
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      formulario.append(campo, item);
    }
  }
  return formulario;
}

export function redirecionaParaLink(token: string): string {
  return `NEXT_REDIRECT:/compartilhado/${encodeURIComponent(token)}`;
}
