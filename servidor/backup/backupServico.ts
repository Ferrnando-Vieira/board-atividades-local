import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { resolverCaminhoAnexo } from '@/servidor/anexos/armazenamentoAnexos';
import { calcularHashConteudo } from '@/servidor/anexos/validacaoAnexos';
import {
  gravarManifesto,
  lerManifesto,
  NOME_ARQUIVO_BANCO_BACKUP,
  NOME_DIRETORIO_ANEXOS_BACKUP,
  VERSAO_FORMATO_BACKUP,
  type ManifestoBackup,
} from '@/servidor/backup/manifestoBackup';
import {
  CODIGOS_ERRO_BACKUP,
  mensagensBackup,
} from '@/servidor/backup/mensagensBackup';
import { contarMigracoesDisponiveis } from '@/servidor/banco/migrador';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const PREFIXO_DIRETORIO_BACKUP = 'backup-';
const PREFIXO_ESTADO_ANTERIOR = 'antes-da-restauracao-';
// O -wal pode guardar gravações ainda não levadas ao arquivo principal, e o
// -shm é o índice dele: os três andam juntos, e um -wal antigo ao lado de um
// banco restaurado seria aplicado sobre ele e o corromperia.
const SUFIXOS_ARQUIVOS_BANCO = ['', '-wal', '-shm'] as const;
const TABELA_CONTROLE_MIGRACOES = '__drizzle_migrations';
const TABELA_ANEXOS = 'anexos';
const RESULTADO_INTEGRIDADE_OK = 'ok';
const PERMISSAO_SOMENTE_DONO = 0o600;
const CODIGOS_ARQUIVO_EM_USO = new Set(['EBUSY', 'EPERM', 'EACCES']);

type AnexoRegistrado = {
  identificadorArquivo: string;
  tamanhoBytes: number;
  hashSha256: string;
};

type EstadoBanco = {
  migracoesAplicadas: number;
  integridade: string;
  violacoesChaveEstrangeira: number;
  anexosAtivos: AnexoRegistrado[];
};

export type OpcoesCriacaoBackup = {
  caminhoBanco: string;
  diretorioAnexos: string;
  diretorioDestino: string;
  agora?: Date;
};

export type BackupCriado = {
  diretorio: string;
  manifesto: ManifestoBackup;
};

export type OpcoesRestauracaoBackup = {
  diretorioBackup: string;
  caminhoBanco: string;
  diretorioAnexos: string;
  agora?: Date;
  migracoesDisponiveis?: number;
};

export type RestauracaoConcluida = {
  manifesto: ManifestoBackup;
  diretorioEstadoAnterior: string | null;
  migracoesPendentes: number;
};

function erroBackup(mensagem: string, codigo: string, status: number) {
  return new ErroApp(mensagem, { status, codigo });
}

function erroBackupInvalido(mensagem: string): ErroApp {
  return erroBackup(
    mensagem,
    CODIGOS_ERRO_BACKUP.BACKUP_INVALIDO,
    STATUS_ERRO.REQUISICAO_INVALIDA,
  );
}

function montarCarimbo(agora: Date): string {
  return agora.toISOString().replace(/[:.]/g, '-');
}

function lerCodigoErro(erro: unknown): string | undefined {
  return typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    typeof erro.code === 'string'
    ? erro.code
    : undefined;
}

function criarDiretorioExclusivo(diretorio: string): void {
  fs.mkdirSync(path.dirname(diretorio), { recursive: true });
  try {
    fs.mkdirSync(diretorio);
  } catch (erro) {
    if (lerCodigoErro(erro) === 'EEXIST') {
      throw erroBackup(
        mensagensBackup.destinoExistente(diretorio),
        CODIGOS_ERRO_BACKUP.DESTINO_EXISTENTE,
        STATUS_ERRO.CONFLITO,
      );
    }
    throw erro;
  }
}

function lerArquivoOuNulo(caminho: string | null): Buffer | null {
  if (!caminho) {
    return null;
  }
  try {
    return fs.readFileSync(caminho);
  } catch (erro) {
    if (lerCodigoErro(erro) === 'ENOENT') {
      return null;
    }
    throw erro;
  }
}

function conteudoConfere(
  conteudo: Buffer | null,
  tamanhoBytes: number,
  hashSha256: string,
): conteudo is Buffer {
  return (
    conteudo !== null &&
    conteudo.byteLength === tamanhoBytes &&
    calcularHashConteudo(conteudo) === hashSha256
  );
}

function tabelaExiste(cliente: Database.Database, nome: string): boolean {
  return (
    cliente
      .prepare(
        "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .pluck()
      .get(nome) === 1
  );
}

function contarMigracoesDoCliente(cliente: Database.Database): number {
  if (!tabelaExiste(cliente, TABELA_CONTROLE_MIGRACOES)) {
    return 0;
  }
  return cliente
    .prepare(`SELECT count(*) FROM "${TABELA_CONTROLE_MIGRACOES}"`)
    .pluck()
    .get() as number;
}

function listarAnexosAtivos(cliente: Database.Database): AnexoRegistrado[] {
  if (!tabelaExiste(cliente, TABELA_ANEXOS)) {
    return [];
  }
  return cliente
    .prepare(
      'SELECT identificador_arquivo AS identificadorArquivo, tamanho_bytes AS tamanhoBytes, hash_sha256 AS hashSha256 FROM anexos WHERE removido_em IS NULL ORDER BY id',
    )
    .all() as AnexoRegistrado[];
}

function lerEstadoBanco(cliente: Database.Database): EstadoBanco {
  return {
    migracoesAplicadas: contarMigracoesDoCliente(cliente),
    integridade: String(cliente.pragma('integrity_check', { simple: true })),
    violacoesChaveEstrangeira: (
      cliente.pragma('foreign_key_check') as unknown[]
    ).length,
    anexosAtivos: listarAnexosAtivos(cliente),
  };
}

// A API de backup do SQLite copia um retrato consistente que inclui o que
// ainda está no -wal; depois a cópia passa a journal DELETE, para ser um
// arquivo único que abre sem criar -wal e -shm na pasta do backup.
async function copiarBancoConsistente(
  caminhoBanco: string,
  caminhoCopia: string,
): Promise<EstadoBanco> {
  const origem = new Database(caminhoBanco, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    await origem.backup(caminhoCopia);
  } finally {
    origem.close();
  }
  const copia = new Database(caminhoCopia, { fileMustExist: true });
  try {
    copia.pragma('journal_mode = DELETE');
    return lerEstadoBanco(copia);
  } finally {
    copia.close();
  }
}

function copiarAnexos(
  anexos: readonly AnexoRegistrado[],
  diretorioOrigem: string,
  diretorioDestino: string,
  criarErro: (identificador: string) => ErroApp,
): number {
  fs.mkdirSync(diretorioDestino, { recursive: true });
  let totalBytes = 0;
  for (const anexo of anexos) {
    const origem = resolverCaminhoAnexo(
      diretorioOrigem,
      anexo.identificadorArquivo,
    );
    const destino = resolverCaminhoAnexo(
      diretorioDestino,
      anexo.identificadorArquivo,
    );
    const conteudo = lerArquivoOuNulo(origem);
    if (
      !destino ||
      !conteudoConfere(conteudo, anexo.tamanhoBytes, anexo.hashSha256)
    ) {
      throw criarErro(anexo.identificadorArquivo);
    }
    fs.writeFileSync(destino, conteudo, {
      flag: 'wx',
      mode: PERMISSAO_SOMENTE_DONO,
    });
    totalBytes += anexo.tamanhoBytes;
  }
  return totalBytes;
}

function erroAnexoInconsistente(identificador: string): ErroApp {
  return erroBackup(
    mensagensBackup.anexoInconsistente(identificador),
    CODIGOS_ERRO_BACKUP.ANEXO_INCONSISTENTE,
    STATUS_ERRO.CONFLITO,
  );
}

function erroAnexoDoBackup(identificador: string): ErroApp {
  return erroBackupInvalido(mensagensBackup.anexoDoBackup(identificador));
}

// Os anexos copiados são os ativos no retrato do banco, então uma remoção
// feita durante o backup aparece como inconsistência (e o backup é desfeito)
// em vez de gerar uma cópia que aponta para arquivo inexistente.
export async function criarBackup(
  opcoes: OpcoesCriacaoBackup,
): Promise<BackupCriado> {
  const caminhoBanco = path.resolve(opcoes.caminhoBanco);
  if (!fs.existsSync(caminhoBanco)) {
    throw erroBackup(
      mensagensBackup.bancoAusente(caminhoBanco),
      CODIGOS_ERRO_BACKUP.BANCO_AUSENTE,
      STATUS_ERRO.CONFLITO,
    );
  }
  const agora = opcoes.agora ?? new Date();
  const diretorio = path.join(
    path.resolve(opcoes.diretorioDestino),
    `${PREFIXO_DIRETORIO_BACKUP}${montarCarimbo(agora)}`,
  );
  criarDiretorioExclusivo(diretorio);
  try {
    const caminhoCopia = path.join(diretorio, NOME_ARQUIVO_BANCO_BACKUP);
    const estado = await copiarBancoConsistente(caminhoBanco, caminhoCopia);
    const bytesAnexos = copiarAnexos(
      estado.anexosAtivos,
      opcoes.diretorioAnexos,
      path.join(diretorio, NOME_DIRETORIO_ANEXOS_BACKUP),
      erroAnexoInconsistente,
    );
    const conteudoCopia = fs.readFileSync(caminhoCopia);
    const manifesto: ManifestoBackup = {
      formato: VERSAO_FORMATO_BACKUP,
      criadoEm: agora.toISOString(),
      migracoesAplicadas: estado.migracoesAplicadas,
      banco: {
        arquivo: NOME_ARQUIVO_BANCO_BACKUP,
        tamanhoBytes: conteudoCopia.byteLength,
        sha256: calcularHashConteudo(conteudoCopia),
      },
      anexos: {
        quantidade: estado.anexosAtivos.length,
        tamanhoBytes: bytesAnexos,
      },
    };
    gravarManifesto(diretorio, manifesto);
    return { diretorio, manifesto };
  } catch (erro) {
    fs.rmSync(diretorio, { recursive: true, force: true });
    throw erro;
  }
}

function conferirAnexosDoBackup(
  anexos: readonly AnexoRegistrado[],
  diretorioAnexosBackup: string,
): number {
  let totalBytes = 0;
  for (const anexo of anexos) {
    const conteudo = lerArquivoOuNulo(
      resolverCaminhoAnexo(diretorioAnexosBackup, anexo.identificadorArquivo),
    );
    if (!conteudoConfere(conteudo, anexo.tamanhoBytes, anexo.hashSha256)) {
      throw erroAnexoDoBackup(anexo.identificadorArquivo);
    }
    totalBytes += anexo.tamanhoBytes;
  }
  return totalBytes;
}

function conferirEstadoDoBackup(
  estado: EstadoBanco,
  manifesto: ManifestoBackup,
): void {
  if (estado.integridade !== RESULTADO_INTEGRIDADE_OK) {
    throw erroBackupInvalido(
      mensagensBackup.integridadeBanco(estado.integridade),
    );
  }
  if (estado.violacoesChaveEstrangeira > 0) {
    throw erroBackupInvalido(
      mensagensBackup.chavesEstrangeiras(estado.violacoesChaveEstrangeira),
    );
  }
  if (estado.migracoesAplicadas !== manifesto.migracoesAplicadas) {
    throw erroBackupInvalido(mensagensBackup.migracoesDiferentes);
  }
}

// Só lê: o banco do backup é aberto somente leitura e em journal DELETE,
// então conferir não cria nem altera arquivo nenhum na pasta do backup.
export function verificarBackup(diretorioBackup: string): ManifestoBackup {
  const diretorio = path.resolve(diretorioBackup);
  const manifesto = lerManifesto(diretorio);
  const caminhoCopia = path.join(diretorio, NOME_ARQUIVO_BANCO_BACKUP);
  if (
    !conteudoConfere(
      lerArquivoOuNulo(caminhoCopia),
      manifesto.banco.tamanhoBytes,
      manifesto.banco.sha256,
    )
  ) {
    throw erroBackupInvalido(mensagensBackup.hashBancoDiferente);
  }
  const copia = new Database(caminhoCopia, {
    readonly: true,
    fileMustExist: true,
  });
  let estado: EstadoBanco;
  try {
    estado = lerEstadoBanco(copia);
  } finally {
    copia.close();
  }
  conferirEstadoDoBackup(estado, manifesto);
  const bytesAnexos = conferirAnexosDoBackup(
    estado.anexosAtivos,
    path.join(diretorio, NOME_DIRETORIO_ANEXOS_BACKUP),
  );
  if (
    estado.anexosAtivos.length !== manifesto.anexos.quantidade ||
    bytesAnexos !== manifesto.anexos.tamanhoBytes
  ) {
    throw erroBackupInvalido(mensagensBackup.manifestoInvalido);
  }
  return manifesto;
}

type Movimento = { de: string; para: string };

function desfazerMovimentos(movimentos: readonly Movimento[]): void {
  for (const movimento of [...movimentos].reverse()) {
    fs.renameSync(movimento.para, movimento.de);
  }
}

function traduzirErroMovimento(erro: unknown): unknown {
  const codigo = lerCodigoErro(erro);
  if (codigo !== undefined && CODIGOS_ARQUIVO_EM_USO.has(codigo)) {
    return erroBackup(
      mensagensBackup.bancoEmUso,
      CODIGOS_ERRO_BACKUP.BANCO_EM_USO,
      STATUS_ERRO.CONFLITO,
    );
  }
  return erro;
}

// No Windows o SQLite abre o banco sem permitir renomeá-lo: com o servidor
// no ar o primeiro movimento falha, o que já andou volta e nada é alterado.
function moverEstadoAtual(
  caminhoBanco: string,
  diretorioAnexos: string,
  diretorioAnterior: string,
): Movimento[] {
  const candidatos: Movimento[] = [
    ...SUFIXOS_ARQUIVOS_BANCO.map((sufixo) => ({
      de: `${caminhoBanco}${sufixo}`,
      para: path.join(
        diretorioAnterior,
        `${path.basename(caminhoBanco)}${sufixo}`,
      ),
    })),
    {
      de: diretorioAnexos,
      para: path.join(diretorioAnterior, path.basename(diretorioAnexos)),
    },
  ];
  const movimentos: Movimento[] = [];
  try {
    for (const candidato of candidatos) {
      if (fs.existsSync(candidato.de)) {
        fs.renameSync(candidato.de, candidato.para);
        movimentos.push(candidato);
      }
    }
  } catch (erro) {
    desfazerMovimentos(movimentos);
    throw traduzirErroMovimento(erro);
  }
  return movimentos;
}

function gravarEstadoDoBackup(
  diretorioBackup: string,
  caminhoBanco: string,
  diretorioAnexos: string,
  manifesto: ManifestoBackup,
): void {
  fs.copyFileSync(
    path.join(diretorioBackup, NOME_ARQUIVO_BANCO_BACKUP),
    caminhoBanco,
    fs.constants.COPYFILE_EXCL,
  );
  if (
    !conteudoConfere(
      lerArquivoOuNulo(caminhoBanco),
      manifesto.banco.tamanhoBytes,
      manifesto.banco.sha256,
    )
  ) {
    throw erroBackupInvalido(mensagensBackup.hashBancoDiferente);
  }
  const copia = new Database(caminhoBanco, {
    readonly: true,
    fileMustExist: true,
  });
  let anexos: AnexoRegistrado[];
  try {
    anexos = lerEstadoBanco(copia).anexosAtivos;
  } finally {
    copia.close();
  }
  copiarAnexos(
    anexos,
    path.join(diretorioBackup, NOME_DIRETORIO_ANEXOS_BACKUP),
    diretorioAnexos,
    erroAnexoDoBackup,
  );
}

function descartarRestauracaoParcial(
  caminhoBanco: string,
  diretorioAnexos: string,
): void {
  for (const sufixo of SUFIXOS_ARQUIVOS_BANCO) {
    fs.rmSync(`${caminhoBanco}${sufixo}`, { force: true });
  }
  fs.rmSync(diretorioAnexos, { recursive: true, force: true });
}

// Nada é apagado: o banco atual (com -wal e -shm) e a pasta de anexos vão
// para "antes-da-restauracao-<data>" ao lado do banco, e voltam ao lugar se
// qualquer etapa falhar.
export function restaurarBackup(
  opcoes: OpcoesRestauracaoBackup,
): RestauracaoConcluida {
  const diretorioBackup = path.resolve(opcoes.diretorioBackup);
  const caminhoBanco = path.resolve(opcoes.caminhoBanco);
  const diretorioAnexos = path.resolve(opcoes.diretorioAnexos);
  const manifesto = verificarBackup(diretorioBackup);
  const migracoesDisponiveis =
    opcoes.migracoesDisponiveis ?? contarMigracoesDisponiveis();
  if (manifesto.migracoesAplicadas > migracoesDisponiveis) {
    throw erroBackup(
      mensagensBackup.versaoIncompativel(
        manifesto.migracoesAplicadas,
        migracoesDisponiveis,
      ),
      CODIGOS_ERRO_BACKUP.VERSAO_INCOMPATIVEL,
      STATUS_ERRO.CONFLITO,
    );
  }
  const diretorioAnterior = path.join(
    path.dirname(caminhoBanco),
    `${PREFIXO_ESTADO_ANTERIOR}${montarCarimbo(opcoes.agora ?? new Date())}`,
  );
  criarDiretorioExclusivo(diretorioAnterior);
  let movimentos: Movimento[];
  try {
    movimentos = moverEstadoAtual(
      caminhoBanco,
      diretorioAnexos,
      diretorioAnterior,
    );
  } catch (erro) {
    fs.rmdirSync(diretorioAnterior);
    throw erro;
  }
  try {
    gravarEstadoDoBackup(
      diretorioBackup,
      caminhoBanco,
      diretorioAnexos,
      manifesto,
    );
  } catch (erro) {
    descartarRestauracaoParcial(caminhoBanco, diretorioAnexos);
    desfazerMovimentos(movimentos);
    fs.rmdirSync(diretorioAnterior);
    throw erro;
  }
  if (movimentos.length === 0) {
    fs.rmdirSync(diretorioAnterior);
  }
  return {
    manifesto,
    diretorioEstadoAnterior: movimentos.length > 0 ? diretorioAnterior : null,
    migracoesPendentes: migracoesDisponiveis - manifesto.migracoesAplicadas,
  };
}
