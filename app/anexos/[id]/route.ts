import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';
import { responderDownloadAnexo } from '@/servidor/web/downloadAnexo';

export async function GET(
  _requisicao: Request,
  contexto: RouteContext<'/anexos/[id]'>,
): Promise<Response> {
  const acesso = await obterAcessoAdministrativo();
  return responderDownloadAnexo((await contexto.params).id, acesso.restricao);
}
