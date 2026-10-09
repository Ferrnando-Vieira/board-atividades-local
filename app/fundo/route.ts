import { obterAcessoAdministrativo } from '@/servidor/web/acessoPainel';
import { responderImagemFundo } from '@/servidor/web/respostaImagemFundo';

export async function GET(requisicao: Request): Promise<Response> {
  await obterAcessoAdministrativo();
  return responderImagemFundo(requisicao);
}
