import {
  formatarTamanhoArquivo,
  montarCabecalhoDownload,
} from '@/util/ArquivoUtils';

const BYTES_POR_KIB = 1024;

describe('ArquivoUtils', () => {
  describe('montarCabecalhoDownload', () => {
    it('deve forçar download com nome ASCII seguro e o nome original em UTF-8', () => {
      const cabecalho = montarCabecalhoDownload('relatório "final".pdf');

      expect(cabecalho).toBe(
        `attachment; filename="relat_rio _final_.pdf"; filename*=UTF-8''relat%C3%B3rio%20%22final%22.pdf`,
      );
    });

    it('deve codificar os caracteres reservados da RFC 5987', () => {
      const cabecalho = montarCabecalhoDownload("o'que (1)*.txt");

      expect(cabecalho).toContain("filename*=UTF-8''o%27que%20%281%29%2A.txt");
    });

    it('não deve permitir que barra invertida feche o parâmetro', () => {
      const cabecalho = montarCabecalhoDownload('a\\"; x=y.txt');

      expect(cabecalho).toContain('filename="a__; x=y.txt"');
    });
  });

  describe('formatarTamanhoArquivo', () => {
    it.each([
      [512, '512 B'],
      [BYTES_POR_KIB, '1 KB'],
      [1536, '1,5 KB'],
      [5 * BYTES_POR_KIB * BYTES_POR_KIB, '5 MB'],
    ])('deve formatar %d bytes como %s', (bytes, esperado) => {
      expect(formatarTamanhoArquivo(bytes)).toBe(esperado);
    });
  });
});
