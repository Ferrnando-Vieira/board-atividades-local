import { obterAcessoCompartilhadoOuNulo } from '@/servidor/web/acessoPainel';
import {
  responderEventosBoard,
  responderSemAcessoEventos,
} from '@/servidor/web/respostaEventos';
import { STATUS_ERRO } from '@/util/ErroApp';

// Avisos de alteração do board (SSE) para quem entra por link. O aviso não
// traz dados: a página recarrega com o escopo do próprio link. Link revogado,
// expirado ou inexistente recebe 404 sem corpo.
export async function GET(
  requisicao: Request,
  contexto: RouteContext<'/compartilhado/[token]/eventos'>,
): Promise<Response> {
  const acesso = await obterAcessoCompartilhadoOuNulo(
    (await contexto.params).token,
  );
  if (!acesso) {
    return responderSemAcessoEventos(STATUS_ERRO.NAO_ENCONTRADO);
  }
  return responderEventosBoard(requisicao);
}
