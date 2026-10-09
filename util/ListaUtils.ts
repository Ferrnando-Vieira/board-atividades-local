export function listasIguais<T>(
  primeira: readonly T[],
  segunda: readonly T[],
): boolean {
  return (
    primeira.length === segunda.length &&
    primeira.every((item, indice) => item === segunda[indice])
  );
}

export function possuiRepetidos<T>(lista: readonly T[]): boolean {
  return new Set(lista).size !== lista.length;
}

function limitarIndice(indice: number, tamanho: number): number {
  return Math.min(Math.max(indice, 0), tamanho);
}

// A posição é contada na lista sem o item, que é exatamente o que o usuário
// enxerga enquanto arrasta: o item sai do lugar e entra entre os demais.
export function moverParaPosicao<T>(
  lista: readonly T[],
  item: T,
  posicao: number,
): T[] {
  const semItem = lista.filter((atual) => atual !== item);
  const resultado = [...semItem];
  resultado.splice(limitarIndice(posicao, semItem.length), 0, item);
  return resultado;
}

export function removerItem<T>(lista: readonly T[], item: T): T[] {
  return lista.filter((atual) => atual !== item);
}
