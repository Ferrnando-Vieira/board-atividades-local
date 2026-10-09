import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { anexarArquivo, removerAnexo } from '@/servidor/anexos/anexosServico';
import {
  criarBackup,
  restaurarBackup,
  verificarBackup,
} from '@/servidor/backup/backupServico';
import { CODIGOS_ERRO_BACKUP } from '@/servidor/backup/mensagensBackup';
import {
  abrirBanco,
  fecharBanco,
  type BancoDados,
} from '@/servidor/banco/conexao';
import {
  aplicarMigracoes,
  contarMigracoesDisponiveis,
} from '@/servidor/banco/migrador';
import { garantirBoardPadrao } from '@/servidor/board/boardRepositorio';
import { CONTEUDOS_ANEXO } from '@/tests/suporte/fabricasAnexos';
import {
  AGORA_TESTE,
  criarAtividadesNoStatus,
  exigirStatusPorChave,
} from '@/tests/suporte/fabricasAtividades';

const NOME_BANCO = 'board.sqlite';
const ARQUIVO_BANCO_BACKUP = 'board-atividades.sqlite';
const SUFIXOS_WAL = ['-wal', '-shm'];
const TITULO_GRAVADO_NO_WAL = 'Gravada só no WAL';
const AGORA_RESTAURACAO = new Date('2026-10-02T10:00:00.000Z');

type Cenario = {
  raiz: string;
  caminhoBanco: string;
  diretorioAnexos: string;
  diretorioBackups: string;
};

function criarCenario(): Cenario {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'board-backup-'));
  return {
    raiz,
    caminhoBanco: path.join(raiz, 'dados', NOME_BANCO),
    diretorioAnexos: path.join(raiz, 'dados', 'anexos'),
    diretorioBackups: path.join(raiz, 'backups'),
  };
}

function prepararBanco(cenario: Cenario): BancoDados {
  const banco = abrirBanco(cenario.caminhoBanco);
  aplicarMigracoes(banco);
  garantirBoardPadrao(banco);
  return banco;
}

function anexar(
  banco: BancoDados,
  cenario: Cenario,
  atividadeId: number,
  nomeArquivo: string,
): number {
  return anexarArquivo(
    banco,
    cenario.diretorioAnexos,
    { atividadeId, nomeArquivo, conteudo: CONTEUDOS_ANEXO.pdf },
    null,
    AGORA_TESTE,
  ).id;
}

function contarAtividades(caminhoBanco: string): number {
  const cliente = new Database(caminhoBanco, { readonly: true });
  try {
    return cliente
      .prepare('SELECT count(*) FROM atividades')
      .pluck()
      .get() as number;
  } finally {
    cliente.close();
  }
}

function listarIdentificadoresAtivos(banco: BancoDados): string[] {
  return banco.$client
    .prepare(
      'SELECT identificador_arquivo FROM anexos WHERE removido_em IS NULL ORDER BY id',
    )
    .pluck()
    .all() as string[];
}

function lerCodigoErro(tarefa: () => unknown): unknown {
  try {
    tarefa();
  } catch (erro) {
    return (erro as { codigo?: unknown }).codigo;
  }
  return undefined;
}

describe('backupServico', () => {
  let cenario: Cenario;

  beforeEach(() => {
    cenario = criarCenario();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(cenario.raiz, { recursive: true, force: true });
  });

  describe('criarBackup', () => {
    it('deve copiar o banco e os anexos ativos com manifesto conferível', async () => {
      const banco = prepararBanco(cenario);
      const statusId = exigirStatusPorChave(banco, 'a-fazer').id;
      const [atividadeId] = criarAtividadesNoStatus(banco, statusId, [
        'Com anexo',
      ]);
      anexar(banco, cenario, atividadeId ?? 0, 'nota.pdf');
      fecharBanco(banco);

      const { diretorio, manifesto } = await criarBackup({
        caminhoBanco: cenario.caminhoBanco,
        diretorioAnexos: cenario.diretorioAnexos,
        diretorioDestino: cenario.diretorioBackups,
        agora: AGORA_TESTE,
      });

      expect(path.basename(diretorio)).toBe('backup-2026-10-01T15-00-00-000Z');
      expect(manifesto.migracoesAplicadas).toBe(contarMigracoesDisponiveis());
      expect(manifesto.anexos).toEqual({
        quantidade: 1,
        tamanhoBytes: CONTEUDOS_ANEXO.pdf.byteLength,
      });
      expect(verificarBackup(diretorio)).toEqual(manifesto);
    });

    it('deve incluir gravações que ainda estão só no -wal', async () => {
      const banco = prepararBanco(cenario);
      banco.$client.pragma('wal_autocheckpoint = 0');
      const statusId = exigirStatusPorChave(banco, 'a-fazer').id;
      criarAtividadesNoStatus(banco, statusId, [TITULO_GRAVADO_NO_WAL]);

      const { diretorio } = await criarBackup({
        caminhoBanco: cenario.caminhoBanco,
        diretorioAnexos: cenario.diretorioAnexos,
        diretorioDestino: cenario.diretorioBackups,
      });
      fecharBanco(banco);

      expect(contarAtividades(path.join(diretorio, ARQUIVO_BANCO_BACKUP))).toBe(
        1,
      );
    });

    it('deve gerar um arquivo único, sem -wal nem -shm, que a verificação não altera', async () => {
      fecharBanco(prepararBanco(cenario));
      const { diretorio } = await criarBackup({
        caminhoBanco: cenario.caminhoBanco,
        diretorioAnexos: cenario.diretorioAnexos,
        diretorioDestino: cenario.diretorioBackups,
      });
      const itensAntes = fs.readdirSync(diretorio).sort();

      verificarBackup(diretorio);

      expect(fs.readdirSync(diretorio).sort()).toEqual(itensAntes);
      for (const sufixo of SUFIXOS_WAL) {
        expect(
          fs.existsSync(
            path.join(diretorio, `${ARQUIVO_BANCO_BACKUP}${sufixo}`),
          ),
        ).toBe(false);
      }
    });

    it('não deve copiar anexo removido nem arquivo órfão', async () => {
      const banco = prepararBanco(cenario);
      const statusId = exigirStatusPorChave(banco, 'a-fazer').id;
      const [atividadeId = 0] = criarAtividadesNoStatus(banco, statusId, ['A']);
      const removidoId = anexar(banco, cenario, atividadeId, 'removido.pdf');
      anexar(banco, cenario, atividadeId, 'ativo.pdf');
      removerAnexo(banco, cenario.diretorioAnexos, {
        atividadeId,
        anexoId: removidoId,
      });
      fs.writeFileSync(
        path.join(cenario.diretorioAnexos, 'orfao_0123456789abcdef'),
        'sobra',
      );
      const ativos = listarIdentificadoresAtivos(banco);
      fecharBanco(banco);

      const { diretorio } = await criarBackup({
        caminhoBanco: cenario.caminhoBanco,
        diretorioAnexos: cenario.diretorioAnexos,
        diretorioDestino: cenario.diretorioBackups,
      });

      expect(fs.readdirSync(path.join(diretorio, 'anexos'))).toEqual(ativos);
    });

    it('deve desfazer o backup quando o arquivo de um anexo ativo sumiu', async () => {
      const banco = prepararBanco(cenario);
      const statusId = exigirStatusPorChave(banco, 'a-fazer').id;
      const [atividadeId = 0] = criarAtividadesNoStatus(banco, statusId, ['A']);
      anexar(banco, cenario, atividadeId, 'nota.pdf');
      const [identificador = ''] = listarIdentificadoresAtivos(banco);
      fecharBanco(banco);
      fs.rmSync(path.join(cenario.diretorioAnexos, identificador));

      await expect(
        criarBackup({
          caminhoBanco: cenario.caminhoBanco,
          diretorioAnexos: cenario.diretorioAnexos,
          diretorioDestino: cenario.diretorioBackups,
        }),
      ).rejects.toMatchObject({
        codigo: CODIGOS_ERRO_BACKUP.ANEXO_INCONSISTENTE,
      });
      expect(fs.readdirSync(cenario.diretorioBackups)).toEqual([]);
    });

    it('deve recusar banco inexistente sem criar pasta de backup', async () => {
      await expect(
        criarBackup({
          caminhoBanco: cenario.caminhoBanco,
          diretorioAnexos: cenario.diretorioAnexos,
          diretorioDestino: cenario.diretorioBackups,
        }),
      ).rejects.toMatchObject({ codigo: CODIGOS_ERRO_BACKUP.BANCO_AUSENTE });
      expect(fs.existsSync(cenario.diretorioBackups)).toBe(false);
    });

    it('deve recusar destino que já existe', async () => {
      fecharBanco(prepararBanco(cenario));
      const opcoes = {
        caminhoBanco: cenario.caminhoBanco,
        diretorioAnexos: cenario.diretorioAnexos,
        diretorioDestino: cenario.diretorioBackups,
        agora: AGORA_TESTE,
      };
      await criarBackup(opcoes);

      await expect(criarBackup(opcoes)).rejects.toMatchObject({
        codigo: CODIGOS_ERRO_BACKUP.DESTINO_EXISTENTE,
      });
    });
  });

  describe('verificarBackup', () => {
    let diretorioBackup: string;

    beforeEach(async () => {
      const banco = prepararBanco(cenario);
      const statusId = exigirStatusPorChave(banco, 'a-fazer').id;
      const [atividadeId = 0] = criarAtividadesNoStatus(banco, statusId, ['A']);
      anexar(banco, cenario, atividadeId, 'nota.pdf');
      fecharBanco(banco);
      diretorioBackup = (
        await criarBackup({
          caminhoBanco: cenario.caminhoBanco,
          diretorioAnexos: cenario.diretorioAnexos,
          diretorioDestino: cenario.diretorioBackups,
        })
      ).diretorio;
    });

    it('deve recusar banco alterado depois do backup', () => {
      fs.appendFileSync(path.join(diretorioBackup, ARQUIVO_BANCO_BACKUP), 'x');

      expect(lerCodigoErro(() => verificarBackup(diretorioBackup))).toBe(
        CODIGOS_ERRO_BACKUP.BACKUP_INVALIDO,
      );
    });

    it('deve recusar anexo alterado no backup', () => {
      const diretorioAnexos = path.join(diretorioBackup, 'anexos');
      const [arquivo = ''] = fs.readdirSync(diretorioAnexos);
      fs.writeFileSync(path.join(diretorioAnexos, arquivo), 'adulterado');

      expect(lerCodigoErro(() => verificarBackup(diretorioBackup))).toBe(
        CODIGOS_ERRO_BACKUP.BACKUP_INVALIDO,
      );
    });

    it('deve recusar pasta sem manifesto', () => {
      fs.rmSync(path.join(diretorioBackup, 'manifesto-backup.json'));

      expect(lerCodigoErro(() => verificarBackup(diretorioBackup))).toBe(
        CODIGOS_ERRO_BACKUP.BACKUP_INVALIDO,
      );
    });
  });

  describe('restaurarBackup', () => {
    let diretorioBackup: string;
    let identificadorDoBackup: string;

    beforeEach(async () => {
      const banco = prepararBanco(cenario);
      const statusId = exigirStatusPorChave(banco, 'a-fazer').id;
      const [atividadeId = 0] = criarAtividadesNoStatus(banco, statusId, [
        'No backup',
      ]);
      anexar(banco, cenario, atividadeId, 'nota.pdf');
      [identificadorDoBackup = ''] = listarIdentificadoresAtivos(banco);
      fecharBanco(banco);
      diretorioBackup = (
        await criarBackup({
          caminhoBanco: cenario.caminhoBanco,
          diretorioAnexos: cenario.diretorioAnexos,
          diretorioDestino: cenario.diretorioBackups,
        })
      ).diretorio;
      const depois = abrirBanco(cenario.caminhoBanco, {
        exigirArquivoExistente: true,
      });
      criarAtividadesNoStatus(depois, statusId, ['Depois do backup']);
      fecharBanco(depois);
    });

    function restaurar() {
      return restaurarBackup({
        diretorioBackup,
        caminhoBanco: cenario.caminhoBanco,
        diretorioAnexos: cenario.diretorioAnexos,
        agora: AGORA_RESTAURACAO,
      });
    }

    it('deve restaurar banco e anexos e guardar o estado anterior', () => {
      const resultado = restaurar();

      expect(contarAtividades(cenario.caminhoBanco)).toBe(1);
      expect(fs.readdirSync(cenario.diretorioAnexos)).toEqual([
        identificadorDoBackup,
      ]);
      expect(resultado.diretorioEstadoAnterior).toBe(
        path.join(
          path.dirname(cenario.caminhoBanco),
          'antes-da-restauracao-2026-10-02T10-00-00-000Z',
        ),
      );
      expect(
        contarAtividades(
          path.join(resultado.diretorioEstadoAnterior ?? '', NOME_BANCO),
        ),
      ).toBe(2);
      expect(resultado.migracoesPendentes).toBe(0);
    });

    it('deve restaurar num destino vazio sem criar pasta de estado anterior', () => {
      const destino = path.join(cenario.raiz, 'nova-maquina');

      const resultado = restaurarBackup({
        diretorioBackup,
        caminhoBanco: path.join(destino, NOME_BANCO),
        diretorioAnexos: path.join(destino, 'anexos'),
      });

      expect(resultado.diretorioEstadoAnterior).toBeNull();
      expect(fs.readdirSync(destino).sort()).toEqual(['anexos', NOME_BANCO]);
    });

    it('deve recusar backup de versão mais nova sem alterar nada', () => {
      const hashAntes = fs.readFileSync(cenario.caminhoBanco);

      const codigo = lerCodigoErro(() =>
        restaurarBackup({
          diretorioBackup,
          caminhoBanco: cenario.caminhoBanco,
          diretorioAnexos: cenario.diretorioAnexos,
          migracoesDisponiveis: 1,
        }),
      );

      expect(codigo).toBe(CODIGOS_ERRO_BACKUP.VERSAO_INCOMPATIVEL);
      expect(fs.readFileSync(cenario.caminhoBanco).equals(hashAntes)).toBe(
        true,
      );
    });

    it('deve manter os dados atuais quando o banco está em uso', () => {
      const renomearOriginal = fs.renameSync;
      jest.spyOn(fs, 'renameSync').mockImplementation((de, para) => {
        if (String(de) === cenario.caminhoBanco) {
          throw Object.assign(new Error('arquivo em uso'), { code: 'EBUSY' });
        }
        renomearOriginal(de, para);
      });

      const codigo = lerCodigoErro(restaurar);

      expect(codigo).toBe(CODIGOS_ERRO_BACKUP.BANCO_EM_USO);
      expect(contarAtividades(cenario.caminhoBanco)).toBe(2);
      expect(
        fs
          .readdirSync(path.dirname(cenario.caminhoBanco))
          .filter((nome) => nome.startsWith('antes-da-restauracao-')),
      ).toEqual([]);
    });

    it('deve devolver o estado anterior quando a gravação da cópia falha', () => {
      jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {
        throw Object.assign(new Error('disco cheio'), { code: 'ENOSPC' });
      });

      expect(restaurar).toThrow('disco cheio');
      expect(contarAtividades(cenario.caminhoBanco)).toBe(2);
      expect(fs.readdirSync(cenario.diretorioAnexos)).toEqual([
        identificadorDoBackup,
      ]);
    });
  });
});
