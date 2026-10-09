// Apelidos de quem está vendo o board sem se identificar (como no Google
// Docs): "Capivara anônima", "Tucano anônimo". Fauna brasileira; o gênero
// garante a concordância do "anônimo/anônima". Um link nomeado pode fixar
// um destes animais (coluna `animal` do link); chave que deixar de existir
// aqui volta a ser sorteada.
export const ANIMAIS = [
  { chave: 'capivara', nome: 'Capivara', genero: 'f', cor: '#a0703c' },
  { chave: 'tucano', nome: 'Tucano', genero: 'm', cor: '#ff9f1c' },
  { chave: 'onca', nome: 'Onça', genero: 'f', cor: '#e8901c' },
  { chave: 'arara', nome: 'Arara', genero: 'f', cor: '#e53935' },
  { chave: 'tamandua', nome: 'Tamanduá', genero: 'm', cor: '#7d6a55' },
  { chave: 'jabuti', nome: 'Jabuti', genero: 'm', cor: '#5c8a2a' },
  { chave: 'boto', nome: 'Boto', genero: 'm', cor: '#ec6f9c' },
  { chave: 'coruja', nome: 'Coruja', genero: 'f', cor: '#8d6e63' },
  { chave: 'preguica', nome: 'Preguiça', genero: 'f', cor: '#a68a64' },
  { chave: 'lobo-guara', nome: 'Lobo-guará', genero: 'm', cor: '#d9622b' },
  {
    chave: 'mico-leao',
    nome: 'Mico-leão-dourado',
    genero: 'm',
    cor: '#f59e0b',
  },
  { chave: 'tatu', nome: 'Tatu', genero: 'm', cor: '#9e8a78' },
  { chave: 'jacare', nome: 'Jacaré', genero: 'm', cor: '#5b8f45' },
  { chave: 'ariranha', nome: 'Ariranha', genero: 'f', cor: '#6b4a32' },
  { chave: 'seriema', nome: 'Seriema', genero: 'f', cor: '#b0a089' },
] as const;

export type Animal = (typeof ANIMAIS)[number];

export type ChaveAnimal = Animal['chave'];

export const CHAVES_ANIMAIS: readonly ChaveAnimal[] = ANIMAIS.map(
  (animal) => animal.chave,
);

export function ehChaveAnimal(valor: unknown): valor is ChaveAnimal {
  return (
    typeof valor === 'string' &&
    (CHAVES_ANIMAIS as readonly string[]).includes(valor)
  );
}

export function obterAnimal(chave: ChaveAnimal): Animal {
  return ANIMAIS.find((animal) => animal.chave === chave) ?? ANIMAIS[0];
}

export function montarApelidoAnonimo(chave: ChaveAnimal): string {
  const animal = obterAnimal(chave);
  return `${animal.nome} ${animal.genero === 'f' ? 'anônima' : 'anônimo'}`;
}
