import { obterAcessoCompartilhadoOuNulo } from '@/servidor/web/acessoPainel';
import {
  responderAnexoNaoEncontrado,
  responderImagemAnexo,
} from '@/servidor/web/downloadAnexo';

// Mesmo escopo do download: imagem de atividade fora do link, ou link
// revogado, recebe 404 como se não existisse.
export async function GET(
  _requisicao: Request,
  contexto: RouteContext<'/compartilhado/[token]/anexos/[id]/imagem'>,
): Promise<Response> {
  const { token, id } = await contexto.params;
  const acesso = await obterAcessoCompartilhadoOuNulo(token);
  if (!acesso) {
    return responderAnexoNaoEncontrado();
  }
  return responderImagemAnexo(id, acesso.restricao);
}
