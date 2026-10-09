const CODIFICADOR = new TextEncoder();

export function montarBytes(
  ...partes: ReadonlyArray<string | readonly number[]>
): Uint8Array {
  const blocos = partes.map((parte) =>
    typeof parte === 'string'
      ? CODIFICADOR.encode(parte)
      : Uint8Array.from(parte),
  );
  const tamanhoTotal = blocos.reduce((soma, bloco) => soma + bloco.length, 0);
  const resultado = new Uint8Array(tamanhoTotal);
  let posicao = 0;
  for (const bloco of blocos) {
    resultado.set(bloco, posicao);
    posicao += bloco.length;
  }
  return resultado;
}

export function montarBytesComTamanho(
  prefixo: string,
  tamanhoBytes: number,
): Uint8Array {
  const resultado = new Uint8Array(tamanhoBytes);
  resultado.set(CODIFICADOR.encode(prefixo));
  return resultado.fill(0x20, prefixo.length);
}

// Cabeçalhos mínimos de cada formato aceito, mais um executável do Windows
// (MZ) para os testes de conteúdo incompatível com a extensão.
export const CONTEUDOS_ANEXO = {
  pdf: montarBytes('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF'),
  png: montarBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
  jpeg: montarBytes([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  gif: montarBytes('GIF89a', [0x01, 0x00]),
  webp: montarBytes('RIFF', [0x24, 0x00, 0x00, 0x00], 'WEBPVP8 '),
  zip: montarBytes([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]),
  ole: montarBytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]),
  texto: montarBytes('Data;Valor\n01/10/2026;10,50\n'),
  executavel: montarBytes('MZ', [0x90, 0x00, 0x03, 0x00]),
} as const;
