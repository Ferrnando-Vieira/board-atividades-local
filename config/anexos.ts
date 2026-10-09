const BYTES_POR_MEBIBYTE = 1024 * 1024;

// Um envio (seção de anexos, ou formulário da atividade com os anexos e as
// imagens coladas na descrição) leva até MAXIMO_POR_ENVIO arquivos, cada um
// com até TAMANHO_MAXIMO_BYTES e no total até TAMANHO_MAXIMO_ENVIO_BYTES. O
// corpo de uma Server Action também carrega os separadores do multipart e os
// demais campos; `next.config.ts` libera o total mais a margem abaixo. Imagens
// coladas na descrição também são anexos e contam no máximo por atividade. A
// limpeza de órfãos só apaga arquivos mais velhos que a idade mínima, para
// não alcançar um envio cujo metadado ainda está sendo gravado.
export const LIMITES_ANEXO = {
  TAMANHO_MAXIMO_BYTES: 10 * BYTES_POR_MEBIBYTE,
  TAMANHO_MAXIMO_ENVIO_BYTES: 25 * BYTES_POR_MEBIBYTE,
  MAXIMO_POR_ENVIO: 10,
  MARGEM_CORPO_ENVIO_BYTES: 512 * 1024,
  MAXIMO_POR_ATIVIDADE: 30,
  IDADE_MINIMA_ORFAO_MINUTOS: 10,
} as const;

// `assinatura` é conferida nos primeiros bytes do conteúdo; `texto` só exige
// que não haja byte nulo (planilhas CSV do Excel nem sempre são UTF-8).
export type AssinaturaAnexo =
  'pdf' | 'png' | 'jpeg' | 'gif' | 'webp' | 'zip' | 'ole' | 'texto';

type TipoAnexoPermitido = {
  tipoConteudo: string;
  assinatura: AssinaturaAnexo;
};

// Catálogo fechado por extensão. O tipo gravado e devolvido no download sai
// daqui, nunca do tipo declarado pelo navegador. HTML, SVG, scripts e
// executáveis ficam de fora.
export const TIPOS_ANEXO_PERMITIDOS = {
  pdf: { tipoConteudo: 'application/pdf', assinatura: 'pdf' },
  png: { tipoConteudo: 'image/png', assinatura: 'png' },
  jpg: { tipoConteudo: 'image/jpeg', assinatura: 'jpeg' },
  jpeg: { tipoConteudo: 'image/jpeg', assinatura: 'jpeg' },
  gif: { tipoConteudo: 'image/gif', assinatura: 'gif' },
  webp: { tipoConteudo: 'image/webp', assinatura: 'webp' },
  txt: { tipoConteudo: 'text/plain', assinatura: 'texto' },
  csv: { tipoConteudo: 'text/csv', assinatura: 'texto' },
  md: { tipoConteudo: 'text/markdown', assinatura: 'texto' },
  docx: {
    tipoConteudo:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    assinatura: 'zip',
  },
  xlsx: {
    tipoConteudo:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    assinatura: 'zip',
  },
  pptx: {
    tipoConteudo:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    assinatura: 'zip',
  },
  odt: {
    tipoConteudo: 'application/vnd.oasis.opendocument.text',
    assinatura: 'zip',
  },
  ods: {
    tipoConteudo: 'application/vnd.oasis.opendocument.spreadsheet',
    assinatura: 'zip',
  },
  zip: { tipoConteudo: 'application/zip', assinatura: 'zip' },
  doc: { tipoConteudo: 'application/msword', assinatura: 'ole' },
  xls: { tipoConteudo: 'application/vnd.ms-excel', assinatura: 'ole' },
} as const satisfies Record<string, TipoAnexoPermitido>;

export type ExtensaoAnexo = keyof typeof TIPOS_ANEXO_PERMITIDOS;

export const EXTENSOES_ANEXO = Object.keys(
  TIPOS_ANEXO_PERMITIDOS,
) as ExtensaoAnexo[];

// Valor do atributo `accept` do campo de arquivo: só filtra a janela de
// escolha do sistema; a validação de verdade acontece no servidor.
export const ACEITE_CAMPO_ANEXO = EXTENSOES_ANEXO.map(
  (extensao) => `.${extensao}`,
).join(',');

export function ehExtensaoAnexo(valor: string): valor is ExtensaoAnexo {
  return Object.hasOwn(TIPOS_ANEXO_PERMITIDOS, valor);
}

// Só estes anexos são exibidos na própria página (miniatura e imagem da
// descrição), com o tipo real e conferido pela assinatura; os demais, SVG
// inclusive, continuam só como download.
export const TIPOS_CONTEUDO_IMAGEM_ANEXO = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export function ehImagemExibivel(tipoConteudo: string): boolean {
  return (TIPOS_CONTEUDO_IMAGEM_ANEXO as readonly string[]).includes(
    tipoConteudo,
  );
}

// Extensão usada para nomear uma imagem colada da área de transferência, que
// chega sem nome (ou como "image.png"). Tipo fora da lista não é aceito.
export const EXTENSAO_POR_TIPO_IMAGEM: Record<
  (typeof TIPOS_CONTEUDO_IMAGEM_ANEXO)[number],
  ExtensaoAnexo
> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export const ACEITE_CAMPO_IMAGEM = TIPOS_CONTEUDO_IMAGEM_ANEXO.join(',');
