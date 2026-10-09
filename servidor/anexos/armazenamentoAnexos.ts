import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

// Mesmo formato do CHECK da tabela anexos: só letras, números, "_" e "-",
// então o identificador nunca sobe de pasta nem aponta para outro arquivo.
const FORMATO_IDENTIFICADOR_ARQUIVO = /^[0-9A-Za-z_-]{16,64}$/;
// 24 bytes aleatórios viram 32 caracteres em base64url.
const BYTES_IDENTIFICADOR_ARQUIVO = 24;
const CRIACAO_EXCLUSIVA = 'wx';
const PERMISSAO_SOMENTE_DONO = 0o600;
const CODIGO_ARQUIVO_AUSENTE = 'ENOENT';

export type ConteudoAnexo = {
  fluxo: ReadableStream<Uint8Array>;
  tamanhoBytes: number;
};

export type ArquivoArmazenado = {
  identificadorArquivo: string;
  modificadoEm: Date;
};

// Conferência estrutural: erros do Node podem vir de outro realm (como nos
// testes), e aí `instanceof Error` falha mesmo sendo um erro de sistema.
function ehArquivoAusente(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    erro.code === CODIGO_ARQUIVO_AUSENTE
  );
}

export function gerarIdentificadorArquivo(): string {
  return randomBytes(BYTES_IDENTIFICADOR_ARQUIVO).toString('base64url');
}

export function resolverCaminhoAnexo(
  diretorioAnexos: string,
  identificadorArquivo: string,
): string | null {
  if (!FORMATO_IDENTIFICADOR_ARQUIVO.test(identificadorArquivo)) {
    return null;
  }
  const diretorio = path.resolve(diretorioAnexos);
  const caminho = path.resolve(diretorio, identificadorArquivo);
  return path.dirname(caminho) === diretorio ? caminho : null;
}

export function abrirConteudoAnexo(
  diretorioAnexos: string,
  identificadorArquivo: string,
): ConteudoAnexo | null {
  const caminho = resolverCaminhoAnexo(diretorioAnexos, identificadorArquivo);
  if (!caminho) {
    return null;
  }
  // O diretório vem da configuração (DIRETORIO_ANEXOS), não do código: sem o
  // aviso ao Turbopack, o build rastrearia o projeto inteiro como dependência.
  let estatisticas: fs.Stats;
  try {
    estatisticas = fs.statSync(/*turbopackIgnore: true*/ caminho);
  } catch {
    return null;
  }
  if (!estatisticas.isFile()) {
    return null;
  }
  return {
    fluxo: Readable.toWeb(
      fs.createReadStream(/*turbopackIgnore: true*/ caminho),
    ) as ReadableStream<Uint8Array>,
    tamanhoBytes: estatisticas.size,
  };
}

// A criação exclusiva ('wx') falha se o arquivo já existir, então um
// identificador repetido nunca sobrescreve outro anexo. O fsync garante que o
// conteúdo está em disco antes de o metadado ser gravado no banco.
export function gravarConteudoAnexo(
  diretorioAnexos: string,
  identificadorArquivo: string,
  conteudo: Uint8Array,
): void {
  const caminho = resolverCaminhoAnexo(diretorioAnexos, identificadorArquivo);
  if (!caminho) {
    throw new Error('Identificador de arquivo de anexo inválido.');
  }
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(caminho), {
    recursive: true,
  });
  const descritor = fs.openSync(
    /*turbopackIgnore: true*/ caminho,
    CRIACAO_EXCLUSIVA,
    PERMISSAO_SOMENTE_DONO,
  );
  let gravado = false;
  try {
    fs.writeFileSync(descritor, conteudo);
    fs.fsyncSync(descritor);
    gravado = true;
  } finally {
    fs.closeSync(descritor);
    if (!gravado) {
      apagarConteudoAnexo(diretorioAnexos, identificadorArquivo);
    }
  }
}

// Devolve falso quando não havia arquivo; outras falhas sobem para quem
// chamou decidir (a remoção lógica já gravada não depende disto).
export function apagarConteudoAnexo(
  diretorioAnexos: string,
  identificadorArquivo: string,
): boolean {
  const caminho = resolverCaminhoAnexo(diretorioAnexos, identificadorArquivo);
  if (!caminho) {
    return false;
  }
  try {
    fs.unlinkSync(/*turbopackIgnore: true*/ caminho);
    return true;
  } catch (erro) {
    if (ehArquivoAusente(erro)) {
      return false;
    }
    throw erro;
  }
}

// Só entram arquivos com nome no formato de identificador: qualquer outro
// item do diretório é ignorado, nunca apagado.
export function listarArquivosArmazenados(
  diretorioAnexos: string,
): ArquivoArmazenado[] {
  let nomes: string[];
  try {
    nomes = fs.readdirSync(/*turbopackIgnore: true*/ diretorioAnexos);
  } catch (erro) {
    if (ehArquivoAusente(erro)) {
      return [];
    }
    throw erro;
  }
  return nomes.flatMap((nome) => {
    const caminho = resolverCaminhoAnexo(diretorioAnexos, nome);
    if (!caminho) {
      return [];
    }
    const estatisticas = fs.statSync(/*turbopackIgnore: true*/ caminho, {
      throwIfNoEntry: false,
    });
    return estatisticas?.isFile()
      ? [{ identificadorArquivo: nome, modificadoEm: estatisticas.mtime }]
      : [];
  });
}
