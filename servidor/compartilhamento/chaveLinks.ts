import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { TOKEN_ALEATORIO_BYTES } from '@/config/constantesSeguranca';
import {
  calcularHashToken,
  gerarTokenSeguro,
  hashesIguais,
} from '@/servidor/seguranca/tokens';

// O nome do arquivo vem da época em que só o link padrão era derivado: trocá-lo
// invalidaria os endereços já distribuídos.
const NOME_ARQUIVO_CHAVE = 'chave-link-padrao';
const CRIACAO_EXCLUSIVA = 'wx';
const SOBRESCRITA = 'w';
const PERMISSAO_SOMENTE_DONO = 0o600;
const CODIGO_ARQUIVO_EXISTENTE = 'EEXIST';
const CODIGO_ARQUIVO_AUSENTE = 'ENOENT';
const CONTEXTO_LINK_PADRAO = 'board-atividades:link-padrao:';
const CONTEXTO_LINK_NOMEADO = 'board-atividades:link:';
const ALGORITMO_DERIVACAO = 'sha256';
const FORMATO_CHAVE = /^[A-Za-z0-9_-]{43}$/;

export type LinkDerivavel = {
  id: number;
  padrao: boolean;
};

function ehErroDeSistema(erro: unknown, codigo: string): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    erro.code === codigo
  );
}

// A chave fica num arquivo ao lado do banco, fora dele: uma cópia só do
// SQLite (um backup, por exemplo) guarda apenas o hash de cada token e não
// permite reconstruir os endereços.
export function resolverCaminhoChaveLinks(caminhoBanco: string): string {
  return path.join(path.dirname(caminhoBanco), NOME_ARQUIVO_CHAVE);
}

// Conteúdo fora do formato vale como chave ausente: o arquivo é regravado na
// próxima criação, e os links derivados da chave antiga deixam de conferir.
export function lerChaveLinks(caminho: string): Buffer | null {
  let conteudo: string;
  try {
    conteudo = fs.readFileSync(/*turbopackIgnore: true*/ caminho, 'utf8');
  } catch (erro) {
    if (ehErroDeSistema(erro, CODIGO_ARQUIVO_AUSENTE)) {
      return null;
    }
    throw erro;
  }
  const texto = conteudo.trim();
  return FORMATO_CHAVE.test(texto) ? Buffer.from(texto, 'base64url') : null;
}

// Arquivo ausente usa criação exclusiva ('wx'): se dois processos tentarem
// ao mesmo tempo, o segundo lê a chave do primeiro em vez de sobrescrevê-la.
export function obterOuCriarChaveLinks(caminho: string): Buffer {
  const existente = lerChaveLinks(caminho);
  if (existente) {
    return existente;
  }
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(caminho), {
    recursive: true,
  });
  const modo = fs.existsSync(/*turbopackIgnore: true*/ caminho)
    ? SOBRESCRITA
    : CRIACAO_EXCLUSIVA;
  try {
    fs.writeFileSync(
      /*turbopackIgnore: true*/ caminho,
      gerarTokenSeguro(TOKEN_ALEATORIO_BYTES),
      { flag: modo, mode: PERMISSAO_SOMENTE_DONO },
    );
  } catch (erro) {
    if (!ehErroDeSistema(erro, CODIGO_ARQUIVO_EXISTENTE)) {
      throw erro;
    }
  }
  const chave = lerChaveLinks(caminho);
  if (!chave) {
    throw new Error(`Não foi possível gravar a chave dos links em ${caminho}.`);
  }
  return chave;
}

// HMAC com chave aleatória de 256 bits: o token tem o mesmo tamanho e a mesma
// imprevisibilidade de um token aleatório e pode ser recalculado para exibir
// o endereço de novo, sem que o banco guarde o token em si.
export function derivarTokenLink(chave: Buffer, link: LinkDerivavel): string {
  const contexto = link.padrao ? CONTEXTO_LINK_PADRAO : CONTEXTO_LINK_NOMEADO;
  return createHmac(ALGORITMO_DERIVACAO, chave)
    .update(`${contexto}${link.id}`)
    .digest('base64url');
}

// Links criados antes da derivação (ou com outra chave) continuam valendo pelo
// hash, mas o endereço deles não pode ser reconstruído.
export function tokenDerivadoConfere(
  chave: Buffer,
  link: LinkDerivavel & { hashToken: string },
): boolean {
  return hashesIguais(
    link.hashToken,
    calcularHashToken(derivarTokenLink(chave, link)),
  );
}
