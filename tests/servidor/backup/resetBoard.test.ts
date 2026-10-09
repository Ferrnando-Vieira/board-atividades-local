import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  apagarDadosBoard,
  CODIGO_BANCO_EM_USO_RESET,
  type OpcoesResetBoard,
} from '@/servidor/backup/resetBoard';

type Cenario = OpcoesResetBoard & {
  raiz: string;
  diretorioBackups: string;
};

function criarCenario(): Cenario {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'reset-board-'));
  return {
    raiz,
    caminhoBanco: path.join(raiz, 'board.sqlite'),
    diretorioAnexos: path.join(raiz, 'anexos'),
    caminhoChaveLinks: path.join(raiz, 'chave-link-padrao'),
    diretorioBackups: path.join(raiz, 'backups'),
  };
}

function popular(cenario: Cenario): void {
  for (const sufixo of ['', '-wal', '-shm']) {
    fs.writeFileSync(`${cenario.caminhoBanco}${sufixo}`, 'banco');
  }
  fs.mkdirSync(path.join(cenario.diretorioAnexos, 'fundos'), {
    recursive: true,
  });
  fs.writeFileSync(path.join(cenario.diretorioAnexos, 'fundos', 'f.png'), 'x');
  fs.writeFileSync(cenario.caminhoChaveLinks, 'chave');
  fs.mkdirSync(cenario.diretorioBackups);
  fs.writeFileSync(path.join(cenario.diretorioBackups, 'manifesto.json'), '{}');
}

describe('resetBoard', () => {
  let cenario: Cenario;

  beforeEach(() => {
    cenario = criarCenario();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(cenario.raiz, { recursive: true, force: true });
  });

  it('deve apagar banco, anexos e chave do link, preservando os backups', () => {
    popular(cenario);

    const apagados = apagarDadosBoard(cenario);

    expect(apagados).toHaveLength(5);
    expect(fs.readdirSync(cenario.raiz)).toEqual(['backups']);
    expect(
      fs.existsSync(path.join(cenario.diretorioBackups, 'manifesto.json')),
    ).toBe(true);
  });

  it('deve funcionar quando só parte dos dados existe', () => {
    fs.writeFileSync(cenario.caminhoBanco, 'banco');

    expect(apagarDadosBoard(cenario)).toEqual([cenario.caminhoBanco]);
    expect(apagarDadosBoard(cenario)).toEqual([]);
  });

  it('não deve apagar nada quando o banco está em uso', () => {
    popular(cenario);
    const renomearOriginal = fs.renameSync;
    let chamadas = 0;
    jest.spyOn(fs, 'renameSync').mockImplementation((de, para) => {
      chamadas += 1;
      // O segundo movimento (o -wal) falha como no Windows com o servidor no
      // ar; o primeiro precisa voltar ao lugar.
      if (chamadas === 2) {
        throw Object.assign(new Error('em uso'), { code: 'EBUSY' });
      }
      renomearOriginal(de, para);
    });

    expect(() => apagarDadosBoard(cenario)).toThrow(
      expect.objectContaining({ codigo: CODIGO_BANCO_EM_USO_RESET }),
    );
    expect(fs.readdirSync(cenario.raiz).sort()).toEqual(
      [
        'anexos',
        'backups',
        'board.sqlite',
        'board.sqlite-shm',
        'board.sqlite-wal',
        'chave-link-padrao',
      ].sort(),
    );
  });
});
