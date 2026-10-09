import { obterAcessoCompartilhadoOuNulo } from '@/servidor/web/acessoPainel';
import {
  responderPresenca,
  responderSemAcessoPresenca,
} from '@/servidor/web/respostaPresenca';
import { STATUS_ERRO } from '@/util/ErroApp';

// Quem entra por link nomeado aparece com o nome do link (e o animal fixo,
// se o link tiver um); pelo link padrão, como animal anônimo. Link revogado,
// expirado ou inexistente recebe 404 sem corpo.
export async function POST(
  requisicao: Request,
  contexto: RouteContext<'/compartilhado/[token]/presenca'>,
): Promise<Response> {
  const acesso = await obterAcessoCompartilhadoOuNulo(
    (await contexto.params).token,
  );
  if (!acesso) {
    return responderSemAcessoPresenca(STATUS_ERRO.NAO_ENCONTRADO);
  }
  return responderPresenca(requisicao, {
    tipo: 'link',
    nome: acesso.nomePresenca,
    animalFixo: acesso.animalPresenca,
  });
}
