import { obterAcessoCompartilhadoOuNulo } from '@/servidor/web/acessoPainel';
import {
  responderAnexoNaoEncontrado,
  responderDownloadAnexo,
} from '@/servidor/web/downloadAnexo';

// O escopo do link vale também aqui: anexo de atividade fora dele, ou link
// revogado, recebe 404 como se não existisse.
export async function GET(
  _requisicao: Request,
  contexto: RouteContext<'/compartilhado/[token]/anexos/[id]'>,
): Promise<Response> {
  const { token, id } = await contexto.params;
  const acesso = await obterAcessoCompartilhadoOuNulo(token);
  if (!acesso) {
    return responderAnexoNaoEncontrado();
  }
  return responderDownloadAnexo(id, acesso.restricao);
}
