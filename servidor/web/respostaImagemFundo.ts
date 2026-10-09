import 'server-only';
import { obterAmbiente } from '@/config/ambiente';
import {
  ESCOPO_BOARD,
  type EscopoAparencia,
} from '@/servidor/board/escopoAparencia';
import { abrirImagemFundo } from '@/servidor/board/fundoBoard';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import { STATUS_ERRO } from '@/util/ErroApp';

const PARAMETRO_VERSAO = 'v';
const TEXTO_NAO_ENCONTRADA = 'Imagem não encontrada.';

// A versão no endereço é o hash da imagem: o cache pode ser longo porque uma
// imagem nova sempre ganha outro endereço, e um endereço antigo responde 404
// em vez de guardar a imagem nova sob a versão velha.
const CABECALHOS_IMAGEM = {
  'Cache-Control': 'private, max-age=31536000, immutable',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Content-Disposition': 'inline',
} as const;

function responderNaoEncontrada(): Response {
  return new Response(TEXTO_NAO_ENCONTRADA, {
    status: STATUS_ERRO.NAO_ENCONTRADO,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// Quem chama já conferiu o acesso (sessão ou link válido nesta requisição)
// e informa o escopo: um link nomeado vê a imagem da própria aparência.
export function responderImagemFundo(
  requisicao: Request,
  escopo: EscopoAparencia = ESCOPO_BOARD,
): Response {
  const versao = new URL(requisicao.url).searchParams.get(PARAMETRO_VERSAO);
  const imagem = abrirImagemFundo(
    obterBancoAplicacao(),
    obterAmbiente().diretorioAnexos,
    escopo,
  );
  if (!imagem || versao !== imagem.hash) {
    imagem?.conteudo.fluxo.cancel().catch(() => undefined);
    return responderNaoEncontrada();
  }
  return new Response(imagem.conteudo.fluxo, {
    headers: {
      ...CABECALHOS_IMAGEM,
      'Content-Type': imagem.tipoConteudo,
      'Content-Length': String(imagem.conteudo.tamanhoBytes),
    },
  });
}
