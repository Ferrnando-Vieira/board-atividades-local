import { gerarChaveNormalizada } from '@/util/NormalizacaoUtils';

const SEPARADOR_PALAVRAS = ' ';

export function extrairPalavrasBusca(termo: string): string[] {
  return [
    ...new Set(
      gerarChaveNormalizada(termo)
        .split(SEPARADOR_PALAVRAS)
        .filter((palavra) => palavra.length > 0),
    ),
  ];
}

// Cada palavra precisa aparecer em algum dos textos, sem diferença de acento
// nem de caixa; a ordem das palavras não importa.
export function textosCorrespondemBusca(
  textos: readonly (string | null)[],
  palavras: readonly string[],
): boolean {
  const conteudo = gerarChaveNormalizada(
    textos.filter((texto): texto is string => texto !== null).join(' '),
  );
  return palavras.every((palavra) => conteudo.includes(palavra));
}
