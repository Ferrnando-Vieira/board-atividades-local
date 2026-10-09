import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';
import { responderImagemAnexo } from '@/servidor/web/downloadAnexo';

export async function GET(
  _requisicao: Request,
  contexto: RouteContext<'/anexos/[id]/imagem'>,
): Promise<Response> {
  const acesso = await obterAcessoAdministrativo();
  return responderImagemAnexo((await contexto.params).id, acesso.restricao);
}
