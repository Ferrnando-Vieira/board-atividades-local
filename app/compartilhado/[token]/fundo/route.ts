import { obterAcessoCompartilhadoOuNulo } from '@/servidor/web/acessoPainel';
import { responderImagemFundo } from '@/servidor/web/respostaImagemFundo';
import { STATUS_ERRO } from '@/util/ErroApp';

// Cada link válido vê o fundo da aparência que exibe (a própria, num link
// nomeado que personalizou, ou a do board); link revogado, expirado ou
// inexistente recebe 404 sem corpo útil.
export async function GET(
  requisicao: Request,
  contexto: RouteContext<'/compartilhado/[token]/fundo'>,
): Promise<Response> {
  const acesso = await obterAcessoCompartilhadoOuNulo(
    (await contexto.params).token,
  );
  if (!acesso) {
    return new Response(null, {
      status: STATUS_ERRO.NAO_ENCONTRADO,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return responderImagemFundo(requisicao, acesso.escopoAparencia);
}
