import { createHash } from 'node:crypto';
import { LIMITES_ANEXO } from '@/config/anexos';
import { LIMITES_TEXTO } from '@/config/constantes';
import {
  CODIGOS_ANEXO,
  extrairExtensaoArquivo,
  normalizarNomeArquivoAnexo,
  validarArquivoAnexo,
} from '@/servidor/anexos/validacaoAnexos';
import { STATUS_ERRO } from '@/util/ErroApp';
import {
  CONTEUDOS_ANEXO,
  montarBytes,
  montarBytesComTamanho,
} from '@/tests/suporte/fabricasAnexos';

const NOME_PDF = 'relatório final.pdf';
const BYTES_ANTES_DO_CABECALHO_PDF = 300;

describe('validacaoAnexos', () => {
  describe('normalizarNomeArquivoAnexo', () => {
    it('deve manter um nome comum com acentos e espaços internos', () => {
      const nome = normalizarNomeArquivoAnexo(NOME_PDF);

      expect(nome).toBe(NOME_PDF);
    });

    it.each([
      ['../../etc/passwd', 'passwd'],
      ['..\\..\\Windows\\win.ini', 'win.ini'],
      ['C:\\fakepath\\nota fiscal.pdf', 'nota fiscal.pdf'],
      ['/var/dados/planilha.xlsx', 'planilha.xlsx'],
    ])('deve descartar o caminho de "%s"', (recebido, esperado) => {
      const nome = normalizarNomeArquivoAnexo(recebido);

      expect(nome).toBe(esperado);
    });

    it('deve remover caracteres de controle do nome', () => {
      const nome = normalizarNomeArquivoAnexo('nota\u0000\u0007\u001f.pdf');

      expect(nome).toBe('nota.pdf');
    });

    it('deve remover marcas de direção que escondem a extensão real', () => {
      const nome = normalizarNomeArquivoAnexo('relatorio\u202Efdp.exe');

      expect(nome).toBe('relatoriofdp.exe');
    });

    it('deve normalizar o nome para NFC e colapsar espaços', () => {
      const nome = normalizarNomeArquivoAnexo('  cafe\u0301   da  manhã.txt ');

      expect(nome).toBe('café da manhã.txt');
    });

    it('deve remover pontos e espaços das pontas', () => {
      const nome = normalizarNomeArquivoAnexo('  relatorio.pdf. . ');

      expect(nome).toBe('relatorio.pdf');
    });

    it.each(['', '   ', '..', '/', 'pasta/', '\u202E'])(
      'deve recusar o nome "%s", que fica vazio após a limpeza',
      (recebido) => {
        expect(() => normalizarNomeArquivoAnexo(recebido)).toThrow(
          expect.objectContaining({
            codigo: CODIGOS_ANEXO.NOME_INVALIDO,
            status: STATUS_ERRO.REQUISICAO_INVALIDA,
          }),
        );
      },
    );

    it('deve recusar nome acima do limite em vez de cortar a extensão', () => {
      const nomeLongo = `${'a'.repeat(LIMITES_TEXTO.NOME_ARQUIVO_ANEXO)}.pdf`;

      expect(() => normalizarNomeArquivoAnexo(nomeLongo)).toThrow(
        expect.objectContaining({ codigo: CODIGOS_ANEXO.NOME_INVALIDO }),
      );
    });
  });

  describe('extrairExtensaoArquivo', () => {
    it.each([
      ['Relatorio.PDF', 'pdf'],
      ['backup.tar.zip', 'zip'],
      ['sem-extensao', null],
      ['.pdf', null],
      ['arquivo.', null],
    ])('deve extrair de "%s" a extensão %p', (nome, esperada) => {
      const extensao = extrairExtensaoArquivo(nome);

      expect(extensao).toBe(esperada);
    });
  });

  describe('validarArquivoAnexo', () => {
    it('deve aceitar PDF e devolver tipo controlado, tamanho e hash SHA-256', () => {
      const conteudo = CONTEUDOS_ANEXO.pdf;

      const arquivo = validarArquivoAnexo(NOME_PDF, conteudo);

      expect(arquivo).toEqual({
        nomeOriginal: NOME_PDF,
        tipoConteudo: 'application/pdf',
        tamanhoBytes: conteudo.byteLength,
        hashSha256: createHash('sha256').update(conteudo).digest('hex'),
      });
    });

    it('deve aceitar PDF com bytes antes do cabeçalho dentro do primeiro kilobyte', () => {
      const conteudo = montarBytes(
        ' '.repeat(BYTES_ANTES_DO_CABECALHO_PDF),
        '%PDF-1.4',
      );

      const arquivo = validarArquivoAnexo('escaneado.pdf', conteudo);

      expect(arquivo.tipoConteudo).toBe('application/pdf');
    });

    it.each([
      ['foto.png', CONTEUDOS_ANEXO.png, 'image/png'],
      ['foto.JPG', CONTEUDOS_ANEXO.jpeg, 'image/jpeg'],
      ['foto.jpeg', CONTEUDOS_ANEXO.jpeg, 'image/jpeg'],
      ['animacao.gif', CONTEUDOS_ANEXO.gif, 'image/gif'],
      ['imagem.webp', CONTEUDOS_ANEXO.webp, 'image/webp'],
      [
        'contrato.docx',
        CONTEUDOS_ANEXO.zip,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      [
        'fretes.xlsx',
        CONTEUDOS_ANEXO.zip,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      ['pacote.zip', CONTEUDOS_ANEXO.zip, 'application/zip'],
      ['antigo.doc', CONTEUDOS_ANEXO.ole, 'application/msword'],
      ['antigo.xls', CONTEUDOS_ANEXO.ole, 'application/vnd.ms-excel'],
      ['notas.txt', CONTEUDOS_ANEXO.texto, 'text/plain'],
      ['valores.csv', CONTEUDOS_ANEXO.texto, 'text/csv'],
      ['leia-me.md', CONTEUDOS_ANEXO.texto, 'text/markdown'],
    ])(
      'deve aceitar "%s" com o tipo do catálogo',
      (nome, conteudo, tipoEsperado) => {
        const arquivo = validarArquivoAnexo(nome, conteudo);

        expect(arquivo.tipoConteudo).toBe(tipoEsperado);
      },
    );

    it.each([
      'pagina.html',
      'desenho.svg',
      'script.js',
      'instalador.exe',
      'atalho.lnk',
      'comandos.ps1',
      'sem-extensao',
      'nota.pdf.exe',
    ])('deve recusar a extensão de "%s"', (nome) => {
      expect(() => validarArquivoAnexo(nome, CONTEUDOS_ANEXO.texto)).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_ANEXO.TIPO_NAO_PERMITIDO,
          status: STATUS_ERRO.TIPO_NAO_SUPORTADO,
        }),
      );
    });

    it('deve recusar executável renomeado para .pdf', () => {
      expect(() =>
        validarArquivoAnexo('nota.pdf', CONTEUDOS_ANEXO.executavel),
      ).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_ANEXO.CONTEUDO_INCOMPATIVEL,
          status: STATUS_ERRO.TIPO_NAO_SUPORTADO,
        }),
      );
    });

    it('deve recusar imagem PNG renomeada para .jpg', () => {
      expect(() =>
        validarArquivoAnexo('foto.jpg', CONTEUDOS_ANEXO.png),
      ).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_ANEXO.CONTEUDO_INCOMPATIVEL,
        }),
      );
    });

    it('deve recusar texto com byte nulo, típico de binário renomeado', () => {
      const conteudo = montarBytes('linha 1', [0x00], 'linha 2');

      expect(() => validarArquivoAnexo('notas.txt', conteudo)).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_ANEXO.CONTEUDO_INCOMPATIVEL,
        }),
      );
    });

    it('deve recusar arquivo vazio', () => {
      expect(() => validarArquivoAnexo('vazio.txt', new Uint8Array())).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_ANEXO.ARQUIVO_VAZIO,
          status: STATUS_ERRO.REQUISICAO_INVALIDA,
        }),
      );
    });

    it('deve aceitar arquivo com exatamente o tamanho máximo', () => {
      const conteudo = montarBytesComTamanho(
        '%PDF-1.7',
        LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES,
      );

      const arquivo = validarArquivoAnexo('grande.pdf', conteudo);

      expect(arquivo.tamanhoBytes).toBe(LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES);
    });

    it('deve recusar arquivo um byte acima do tamanho máximo', () => {
      const conteudo = montarBytesComTamanho(
        '%PDF-1.7',
        LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES + 1,
      );

      expect(() => validarArquivoAnexo('grande.pdf', conteudo)).toThrow(
        expect.objectContaining({
          codigo: CODIGOS_ANEXO.ARQUIVO_GRANDE,
          status: STATUS_ERRO.CORPO_GRANDE_DEMAIS,
        }),
      );
    });

    it('deve validar o nome antes de aceitar um caminho hostil', () => {
      const arquivo = validarArquivoAnexo(
        '../../../public/relatorio.pdf',
        CONTEUDOS_ANEXO.pdf,
      );

      expect(arquivo.nomeOriginal).toBe('relatorio.pdf');
    });
  });
});
