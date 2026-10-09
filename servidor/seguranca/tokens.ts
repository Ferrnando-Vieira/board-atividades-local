import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  CODIGO_CONFIGURACAO_INICIAL,
  TOKEN_ALEATORIO_BYTES,
} from '@/config/constantesSeguranca';

// Base32 de Crockford: sem I, L, O e U, para o código ser digitado sem
// confusão entre letras e números.
const ALFABETO_CODIGO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BITS_POR_CARACTERE = 5;
const BITS_POR_BYTE = 8;
const MASCARA_CARACTERE = 0b11111;
const SEPARADOR_GRUPOS = '-';

export function gerarTokenSeguro(
  quantidadeBytes: number = TOKEN_ALEATORIO_BYTES,
): string {
  return randomBytes(quantidadeBytes).toString('base64url');
}

export const SITUACOES_CREDENCIAL = ['ativo', 'expirado', 'revogado'] as const;

export type SituacaoCredencial = (typeof SITUACOES_CREDENCIAL)[number];

export type SituacaoValidade = Exclude<SituacaoCredencial, 'revogado'>;

export function determinarSituacaoValidade(
  expiraEm: string | null,
  agora: Date,
): SituacaoValidade {
  return expiraEm !== null && expiraEm <= agora.toISOString()
    ? 'expirado'
    : 'ativo';
}

// Revogação prevalece sobre expiração: um link revogado depois de vencer
// continua aparecendo como revogado.
export function determinarSituacaoCredencial(
  revogadoEm: string | null,
  expiraEm: string | null,
  agora: Date,
): SituacaoCredencial {
  return revogadoEm === null
    ? determinarSituacaoValidade(expiraEm, agora)
    : 'revogado';
}

// Tokens têm 256 bits de entropia, então SHA-256 sem sal basta: não há
// dicionário viável, e o hash permite busca direta pelo índice único.
export function calcularHashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function hashesIguais(hashA: string, hashB: string): boolean {
  const bufferA = Buffer.from(hashA, 'hex');
  const bufferB = Buffer.from(hashB, 'hex');
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

function codificarBase32(bytes: Buffer): string {
  let resultado = '';
  let acumulador = 0;
  let bitsAcumulados = 0;
  for (const byte of bytes) {
    acumulador = (acumulador << BITS_POR_BYTE) | byte;
    bitsAcumulados += BITS_POR_BYTE;
    while (bitsAcumulados >= BITS_POR_CARACTERE) {
      bitsAcumulados -= BITS_POR_CARACTERE;
      resultado +=
        ALFABETO_CODIGO[(acumulador >> bitsAcumulados) & MASCARA_CARACTERE];
    }
  }
  if (bitsAcumulados > 0) {
    resultado +=
      ALFABETO_CODIGO[
        (acumulador << (BITS_POR_CARACTERE - bitsAcumulados)) &
          MASCARA_CARACTERE
      ];
  }
  return resultado;
}

function agruparCaracteres(texto: string, tamanhoGrupo: number): string {
  const grupos: string[] = [];
  for (let inicio = 0; inicio < texto.length; inicio += tamanhoGrupo) {
    grupos.push(texto.slice(inicio, inicio + tamanhoGrupo));
  }
  return grupos.join(SEPARADOR_GRUPOS);
}

export function gerarCodigoLegivel(): string {
  const bytes = randomBytes(CODIGO_CONFIGURACAO_INICIAL.BYTES_ALEATORIOS);
  return agruparCaracteres(
    codificarBase32(bytes),
    CODIGO_CONFIGURACAO_INICIAL.TAMANHO_GRUPO,
  );
}

// Aceita o código digitado com minúsculas, espaços ou sem hífens.
export function normalizarCodigoLegivel(codigo: string): string {
  const semSeparadores = codigo.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return agruparCaracteres(
    semSeparadores,
    CODIGO_CONFIGURACAO_INICIAL.TAMANHO_GRUPO,
  );
}
