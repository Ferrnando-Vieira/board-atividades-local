import { obterSessaoAtual } from '@/servidor/web/acessoAdministrativo';
import {
  responderEventosBoard,
  responderSemAcessoEventos,
} from '@/servidor/web/respostaEventos';
import { STATUS_ERRO } from '@/util/ErroApp';

// Avisos de alteração do board (SSE) para o proprietário. Sem sessão a
// resposta é 401: o EventSource desiste em vez de reconectar sem parar.
export async function GET(requisicao: Request): Promise<Response> {
  if (!(await obterSessaoAtual())) {
    return responderSemAcessoEventos(STATUS_ERRO.NAO_AUTORIZADO);
  }
  return responderEventosBoard(requisicao);
}
