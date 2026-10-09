import { obterAmbiente } from '@/config/ambiente';

// Sem 'server-only': o proxy também usa estas opções, e lá esse import
// falharia. Login e renovação precisam gravar o cookie exatamente igual.
export function montarOpcoesCookieSessao(expiraEm: string) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: obterAmbiente().cookieSeguro,
    path: '/',
    expires: new Date(expiraEm),
  } as const;
}
