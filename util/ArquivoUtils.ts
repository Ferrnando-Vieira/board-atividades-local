const CARACTERES_INSEGUROS_NO_NOME_ASCII = /[^\x20-\x7e]|["\\]/g;
const CARACTERES_RESERVADOS_RFC_5987 = /['()*]/g;
const SUBSTITUTO_CARACTERE = '_';
const BASE_HEXADECIMAL = 16;
const BYTES_POR_UNIDADE = 1024;
const UNIDADES_TAMANHO = ['B', 'KB', 'MB', 'GB'] as const;
const FORMATADOR_TAMANHO = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
});

export function formatarTamanhoArquivo(bytes: number): string {
  let valor = bytes;
  let indiceUnidade = 0;
  while (
    valor >= BYTES_POR_UNIDADE &&
    indiceUnidade < UNIDADES_TAMANHO.length - 1
  ) {
    valor /= BYTES_POR_UNIDADE;
    indiceUnidade += 1;
  }
  return `${FORMATADOR_TAMANHO.format(valor)} ${UNIDADES_TAMANHO[indiceUnidade]}`;
}

function codificarRfc5987(valor: string): string {
  return encodeURIComponent(valor).replace(
    CARACTERES_RESERVADOS_RFC_5987,
    (caractere) =>
      `%${caractere.charCodeAt(0).toString(BASE_HEXADECIMAL).toUpperCase()}`,
  );
}

function montarParametrosNome(nomeArquivo: string): string {
  const nomeAscii = nomeArquivo.replace(
    CARACTERES_INSEGUROS_NO_NOME_ASCII,
    SUBSTITUTO_CARACTERE,
  );
  return `filename="${nomeAscii}"; filename*=UTF-8''${codificarRfc5987(nomeArquivo)}`;
}

// nosniff e a CSP sandbox vão na própria resposta, além dos cabeçalhos
// globais do next.config: se o arquivo for aberto em vez de baixado, não roda
// script nem carrega recurso algum.
export const CABECALHOS_ARQUIVO_PRIVADO = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
} as const;

// RFC 6266: `filename` em ASCII para clientes antigos e `filename*` com o
// nome original em UTF-8. Aspas e barras não podem fechar o parâmetro.
export function montarCabecalhoDownload(nomeArquivo: string): string {
  return `attachment; ${montarParametrosNome(nomeArquivo)}`;
}

// Imagem aberta na própria aba (e "salvar como" com o nome original).
export function montarCabecalhoExibicao(nomeArquivo: string): string {
  return `inline; ${montarParametrosNome(nomeArquivo)}`;
}
