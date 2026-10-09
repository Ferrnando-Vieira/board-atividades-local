import { z } from 'zod';
import {
  obterEstadoPresenca,
  registrarSinal,
  removerVisitante,
  type IdentidadePresenca,
} from '@/servidor/presenca/presencaBoard';
import { STATUS_ERRO } from '@/util/ErroApp';

const CABECALHOS = { 'Cache-Control': 'no-store' } as const;
const TIPO_JSON = 'application/json';
const TAMANHO_MAXIMO_CORPO = 512;
const STATUS_SEM_CONTEUDO = 204;

// O identificador é gerado no navegador (base64url aleatório); qualquer outra
// coisa é recusada antes de chegar ao estado em memória.
const esquemaSinalPresenca = z.strictObject({
  visitanteId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  saindo: z.boolean().optional(),
});

export function responderSemAcessoPresenca(status: number): Response {
  return new Response(null, { status, headers: CABECALHOS });
}

// Só aceita JSON (um formulário de outro site não consegue enviar esse tipo
// sem preflight, e não há CORS). O acesso é conferido pela rota antes.
export async function responderPresenca(
  requisicao: Request,
  identidade: IdentidadePresenca,
): Promise<Response> {
  const tipoConteudo = requisicao.headers.get('content-type') ?? '';
  if (!tipoConteudo.toLowerCase().startsWith(TIPO_JSON)) {
    return responderSemAcessoPresenca(STATUS_ERRO.TIPO_NAO_SUPORTADO);
  }
  const texto = await requisicao.text();
  if (texto.length > TAMANHO_MAXIMO_CORPO) {
    return responderSemAcessoPresenca(STATUS_ERRO.CORPO_GRANDE_DEMAIS);
  }
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return responderSemAcessoPresenca(STATUS_ERRO.REQUISICAO_INVALIDA);
  }
  const sinal = esquemaSinalPresenca.safeParse(corpo);
  if (!sinal.success) {
    return responderSemAcessoPresenca(STATUS_ERRO.REQUISICAO_INVALIDA);
  }
  const estado = obterEstadoPresenca();
  if (sinal.data.saindo) {
    removerVisitante(estado, sinal.data.visitanteId);
    return new Response(null, {
      status: STATUS_SEM_CONTEUDO,
      headers: CABECALHOS,
    });
  }
  return Response.json(
    registrarSinal(estado, {
      ...identidade,
      visitanteId: sinal.data.visitanteId,
      agora: Date.now(),
    }),
    { headers: CABECALHOS },
  );
}
