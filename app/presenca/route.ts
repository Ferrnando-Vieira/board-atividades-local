import { obterSessaoAtual } from '@/servidor/web/acessoAdministrativo';
import {
  responderPresenca,
  responderSemAcessoPresenca,
} from '@/servidor/web/respostaPresenca';
import { STATUS_ERRO } from '@/util/ErroApp';

// Sinal de presença do proprietário. Sem sessão a resposta é 401 (não um
// redirecionamento): o sinal roda em segundo plano e não pode navegar a
// página.
export async function POST(requisicao: Request): Promise<Response> {
  if (!(await obterSessaoAtual())) {
    return responderSemAcessoPresenca(STATUS_ERRO.NAO_AUTORIZADO);
  }
  return responderPresenca(requisicao, { tipo: 'proprietario' });
}
