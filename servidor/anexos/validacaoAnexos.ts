import { createHash } from 'node:crypto';
import {
  ehExtensaoAnexo,
  LIMITES_ANEXO,
  TIPOS_ANEXO_PERMITIDOS,
  type AssinaturaAnexo,
} from '@/config/anexos';
import { LIMITES_TEXTO } from '@/config/constantes';
import { mensagensAnexos as mensagens } from '@/servidor/anexos/mensagensAnexos';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

export const CODIGOS_ANEXO = {
  ARQUIVO_AUSENTE: 'arquivo-ausente',
  ARQUIVO_VAZIO: 'arquivo-vazio',
  ARQUIVO_GRANDE: 'arquivo-grande-demais',
  NOME_INVALIDO: 'nome-arquivo-invalido',
  TIPO_NAO_PERMITIDO: 'tipo-arquivo-nao-permitido',
  CONTEUDO_INCOMPATIVEL: 'conteudo-incompativel',
  LIMITE_ANEXOS: 'limite-de-anexos',
  ARQUIVOS_DEMAIS: 'arquivos-demais',
  ENVIO_GRANDE: 'envio-grande-demais',
  IMAGEM_NAO_PERMITIDA: 'imagem-nao-permitida',
  REFERENCIA_INVALIDA: 'referencia-imagem-invalida',
  ANEXO_INEXISTENTE: 'anexo-inexistente',
} as const;

const SEPARADORES_CAMINHO = /[\\/]/;
const CARACTERES_CONTROLE = /\p{Cc}/gu;
// Marcas de direção invertem a leitura do nome ("relatorio\u202Efdp.exe"
// aparece como "relatorioexe.pdf") e escondem a extensão real.
const MARCAS_DIRECAO = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const ESPACOS_REPETIDOS = /\s+/g;
const PONTOS_E_ESPACOS_NAS_PONTAS = /^[\s.]+|[\s.]+$/g;
const SEPARADOR_EXTENSAO = '.';
const ALGORITMO_HASH = 'sha256';
const FORMATO_HASH = 'hex';
const LIMITE_BUSCA_CABECALHO_PDF = 1024;
const DESLOCAMENTO_MARCA_WEBP = 8;
const BYTE_NULO = 0;

function bytesAscii(texto: string): number[] {
  return Array.from(texto, (caractere) => caractere.charCodeAt(0));
}

const ASSINATURAS = {
  PDF: bytesAscii('%PDF-'),
  PNG: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  JPEG: [0xff, 0xd8, 0xff],
  GIF87A: bytesAscii('GIF87a'),
  GIF89A: bytesAscii('GIF89a'),
  RIFF: bytesAscii('RIFF'),
  WEBP: bytesAscii('WEBP'),
  ZIP: [0x50, 0x4b, 0x03, 0x04],
  ZIP_VAZIO: [0x50, 0x4b, 0x05, 0x06],
  OLE: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
} as const;

function contemNaPosicao(
  conteudo: Uint8Array,
  bytes: readonly number[],
  posicao = 0,
): boolean {
  return bytes.every((byte, indice) => conteudo[posicao + indice] === byte);
}

// O PDF admite bytes antes do cabeçalho, desde que no primeiro kilobyte.
function contemCabecalhoPdf(conteudo: Uint8Array): boolean {
  const limite = Math.min(
    conteudo.byteLength - ASSINATURAS.PDF.length,
    LIMITE_BUSCA_CABECALHO_PDF,
  );
  for (let posicao = 0; posicao <= limite; posicao += 1) {
    if (contemNaPosicao(conteudo, ASSINATURAS.PDF, posicao)) {
      return true;
    }
  }
  return false;
}

const VERIFICADORES_ASSINATURA: Record<
  AssinaturaAnexo,
  (conteudo: Uint8Array) => boolean
> = {
  pdf: contemCabecalhoPdf,
  png: (conteudo) => contemNaPosicao(conteudo, ASSINATURAS.PNG),
  jpeg: (conteudo) => contemNaPosicao(conteudo, ASSINATURAS.JPEG),
  gif: (conteudo) =>
    contemNaPosicao(conteudo, ASSINATURAS.GIF87A) ||
    contemNaPosicao(conteudo, ASSINATURAS.GIF89A),
  webp: (conteudo) =>
    contemNaPosicao(conteudo, ASSINATURAS.RIFF) &&
    contemNaPosicao(conteudo, ASSINATURAS.WEBP, DESLOCAMENTO_MARCA_WEBP),
  zip: (conteudo) =>
    contemNaPosicao(conteudo, ASSINATURAS.ZIP) ||
    contemNaPosicao(conteudo, ASSINATURAS.ZIP_VAZIO),
  ole: (conteudo) => contemNaPosicao(conteudo, ASSINATURAS.OLE),
  texto: (conteudo) => !conteudo.includes(BYTE_NULO),
};

export type ArquivoAnexoValidado = {
  nomeOriginal: string;
  tipoConteudo: string;
  tamanhoBytes: number;
  hashSha256: string;
};

function erroNomeInvalido(mensagem: string = mensagens.nomeInvalido): ErroApp {
  return new ErroApp(mensagem, {
    status: STATUS_ERRO.REQUISICAO_INVALIDA,
    codigo: CODIGOS_ANEXO.NOME_INVALIDO,
  });
}

export function exigirTamanhoAnexoPermitido(tamanhoBytes: number): void {
  if (tamanhoBytes <= 0) {
    throw new ErroApp(mensagens.arquivoVazio, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ANEXO.ARQUIVO_VAZIO,
    });
  }
  if (tamanhoBytes > LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES) {
    throw new ErroApp(mensagens.arquivoGrande, {
      status: STATUS_ERRO.CORPO_GRANDE_DEMAIS,
      codigo: CODIGOS_ANEXO.ARQUIVO_GRANDE,
    });
  }
}

// O nome original é só metadado (exibição e Content-Disposition): nunca vira
// caminho em disco. Mesmo assim, caminhos, caracteres de controle e marcas
// de direção são descartados para que o nome exibido seja o nome real.
export function normalizarNomeArquivoAnexo(nomeRecebido: string): string {
  const ultimoSegmento = nomeRecebido.split(SEPARADORES_CAMINHO).at(-1) ?? '';
  const nome = ultimoSegmento
    .normalize('NFC')
    .replace(CARACTERES_CONTROLE, '')
    .replace(MARCAS_DIRECAO, '')
    .replace(ESPACOS_REPETIDOS, ' ')
    .replace(PONTOS_E_ESPACOS_NAS_PONTAS, '');
  if (nome === '') {
    throw erroNomeInvalido();
  }
  if (nome.length > LIMITES_TEXTO.NOME_ARQUIVO_ANEXO) {
    throw erroNomeInvalido(mensagens.nomeLongo);
  }
  return nome;
}

export function extrairExtensaoArquivo(nome: string): string | null {
  const indice = nome.lastIndexOf(SEPARADOR_EXTENSAO);
  if (indice <= 0 || indice === nome.length - 1) {
    return null;
  }
  return nome.slice(indice + 1).toLowerCase();
}

export function calcularHashConteudo(conteudo: Uint8Array): string {
  return createHash(ALGORITMO_HASH).update(conteudo).digest(FORMATO_HASH);
}

export function validarArquivoAnexo(
  nomeRecebido: string,
  conteudo: Uint8Array,
): ArquivoAnexoValidado {
  exigirTamanhoAnexoPermitido(conteudo.byteLength);
  const nomeOriginal = normalizarNomeArquivoAnexo(nomeRecebido);
  const extensao = extrairExtensaoArquivo(nomeOriginal);
  if (extensao === null || !ehExtensaoAnexo(extensao)) {
    throw new ErroApp(mensagens.tipoNaoPermitido, {
      status: STATUS_ERRO.TIPO_NAO_SUPORTADO,
      codigo: CODIGOS_ANEXO.TIPO_NAO_PERMITIDO,
    });
  }
  const tipo = TIPOS_ANEXO_PERMITIDOS[extensao];
  if (!VERIFICADORES_ASSINATURA[tipo.assinatura](conteudo)) {
    throw new ErroApp(mensagens.conteudoIncompativel, {
      status: STATUS_ERRO.TIPO_NAO_SUPORTADO,
      codigo: CODIGOS_ANEXO.CONTEUDO_INCOMPATIVEL,
    });
  }
  return {
    nomeOriginal,
    tipoConteudo: tipo.tipoConteudo,
    tamanhoBytes: conteudo.byteLength,
    hashSha256: calcularHashConteudo(conteudo),
  };
}
