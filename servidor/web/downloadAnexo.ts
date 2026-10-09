import 'server-only';
import { ehImagemExibivel } from '@/config/anexos';
import { obterAmbiente } from '@/config/ambiente';
import { lerIdentificadorRota } from '@/config/rotas';
import { abrirConteudoAnexo } from '@/servidor/anexos/armazenamentoAnexos';
import { consultarAnexoAutorizado } from '@/servidor/anexos/consultasAnexos';
import type { RestricaoLeitura } from '@/servidor/atividades/filtrosAtividades';
import { obterBancoAplicacao } from '@/servidor/web/bancoAplicacao';
import {
  montarCabecalhoDownload,
  montarCabecalhoExibicao,
} from '@/util/ArquivoUtils';
import { STATUS_ERRO } from '@/util/ErroApp';

const TEXTO_NAO_ENCONTRADO = 'Anexo não encontrado.';

// nosniff e a CSP sandbox também vão na própria resposta, além dos cabeçalhos
// globais do next.config: se o arquivo for aberto em vez de baixado, não roda
// script nem carrega recurso algum.
const CABECALHOS_ARQUIVO_PRIVADO = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
} as const;

export function responderAnexoNaoEncontrado(): Response {
  return new Response(TEXTO_NAO_ENCONTRADO, {
    status: STATUS_ERRO.NAO_ENCONTRADO,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function abrirAnexoAutorizado(
  identificador: string | string[] | undefined,
  restricao: RestricaoLeitura,
  aceitarTipo: (tipoConteudo: string) => boolean = () => true,
) {
  const anexoId = lerIdentificadorRota(identificador);
  if (anexoId === null) {
    return null;
  }
  const anexo = consultarAnexoAutorizado(
    obterBancoAplicacao(),
    anexoId,
    restricao,
  );
  const conteudo =
    anexo && aceitarTipo(anexo.tipoConteudo)
      ? abrirConteudoAnexo(
          obterAmbiente().diretorioAnexos,
          anexo.identificadorArquivo,
        )
      : null;
  return anexo && conteudo ? { anexo, conteudo } : null;
}

// Sempre como download (octet-stream + attachment): um HTML ou SVG enviado
// como anexo não é interpretado na origem do board. Fora do escopo, removido
// ou sem arquivo em disco, a resposta é a mesma 404, sem caminho físico.
export function responderDownloadAnexo(
  identificador: string | string[] | undefined,
  restricao: RestricaoLeitura,
): Response {
  const aberto = abrirAnexoAutorizado(identificador, restricao);
  if (!aberto) {
    return responderAnexoNaoEncontrado();
  }
  const { anexo, conteudo } = aberto;
  return new Response(conteudo.fluxo, {
    headers: {
      ...CABECALHOS_ARQUIVO_PRIVADO,
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': montarCabecalhoDownload(anexo.nomeOriginal),
      'Content-Length': String(conteudo.tamanhoBytes),
    },
  });
}

// Exibição na página (miniatura e imagem da descrição): só PNG, JPEG, GIF e
// WebP, com o tipo gravado no envio (do catálogo, conferido pela assinatura,
// nunca o declarado pelo navegador) e os mesmos nosniff, CSP sandbox e
// no-store do download. Qualquer outro anexo responde 404 aqui e continua
// disponível só como download.
export function responderImagemAnexo(
  identificador: string | string[] | undefined,
  restricao: RestricaoLeitura,
): Response {
  const aberto = abrirAnexoAutorizado(
    identificador,
    restricao,
    ehImagemExibivel,
  );
  if (!aberto) {
    return responderAnexoNaoEncontrado();
  }
  const { anexo, conteudo } = aberto;
  return new Response(conteudo.fluxo, {
    headers: {
      ...CABECALHOS_ARQUIVO_PRIVADO,
      'Content-Type': anexo.tipoConteudo,
      'Content-Disposition': montarCabecalhoExibicao(anexo.nomeOriginal),
      'Content-Length': String(conteudo.tamanhoBytes),
    },
  });
}
