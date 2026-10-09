import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  CODIGOS_ERRO_BACKUP,
  mensagensBackup,
} from '@/servidor/backup/mensagensBackup';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

export const VERSAO_FORMATO_BACKUP = 1;
export const NOME_ARQUIVO_BANCO_BACKUP = 'board-atividades.sqlite';
export const NOME_DIRETORIO_ANEXOS_BACKUP = 'anexos';
const NOME_MANIFESTO = 'manifesto-backup.json';
const INDENTACAO_MANIFESTO = 2;
const FORMATO_SHA256 = /^[0-9a-f]{64}$/;

const esquemaManifesto = z.strictObject({
  formato: z.literal(VERSAO_FORMATO_BACKUP),
  criadoEm: z.iso.datetime(),
  migracoesAplicadas: z.int().nonnegative(),
  banco: z.strictObject({
    arquivo: z.literal(NOME_ARQUIVO_BANCO_BACKUP),
    tamanhoBytes: z.int().positive(),
    sha256: z.string().regex(FORMATO_SHA256),
  }),
  anexos: z.strictObject({
    quantidade: z.int().nonnegative(),
    tamanhoBytes: z.int().nonnegative(),
  }),
});

export type ManifestoBackup = z.infer<typeof esquemaManifesto>;

export function gravarManifesto(
  diretorioBackup: string,
  manifesto: ManifestoBackup,
): void {
  fs.writeFileSync(
    path.join(diretorioBackup, NOME_MANIFESTO),
    `${JSON.stringify(manifesto, null, INDENTACAO_MANIFESTO)}\n`,
    { flag: 'wx' },
  );
}

export function lerManifesto(diretorioBackup: string): ManifestoBackup {
  let conteudo: unknown;
  try {
    conteudo = JSON.parse(
      fs.readFileSync(path.join(diretorioBackup, NOME_MANIFESTO), 'utf8'),
    );
  } catch {
    conteudo = undefined;
  }
  const resultado = esquemaManifesto.safeParse(conteudo);
  if (!resultado.success) {
    throw new ErroApp(mensagensBackup.manifestoInvalido, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ERRO_BACKUP.BACKUP_INVALIDO,
    });
  }
  return resultado.data;
}
