const ESPACOS_EM_SEQUENCIA = /\s+/g;
const MARCAS_COMBINANTES = /\p{M}/gu;
const LOCALIDADE = 'pt-BR';

const COMPARADOR_TEXTOS = new Intl.Collator(LOCALIDADE, {
  sensitivity: 'base',
  numeric: true,
});

export function normalizarNomeExibicao(nome: string): string {
  return nome.normalize('NFC').replace(ESPACOS_EM_SEQUENCIA, ' ').trim();
}

// A chave ignora caixa e acentos para que "Revisão técnica" e
// "revisao  tecnica" apontem para o mesmo registro.
export function gerarChaveNormalizada(nome: string): string {
  return normalizarNomeExibicao(nome)
    .normalize('NFD')
    .replace(MARCAS_COMBINANTES, '')
    .normalize('NFC')
    .toLocaleLowerCase(LOCALIDADE);
}

export function compararTextos(primeiro: string, segundo: string): number {
  return COMPARADOR_TEXTOS.compare(primeiro, segundo);
}

// Mantém a grafia da primeira ocorrência, como o banco faz com tags e
// solicitantes, e descarta nomes que ficam vazios depois de normalizados.
export function removerNomesRepetidos(nomes: readonly string[]): string[] {
  const chavesVistas = new Set<string>();
  const resultado: string[] = [];
  for (const nome of nomes) {
    const nomeExibicao = normalizarNomeExibicao(nome);
    const chave = gerarChaveNormalizada(nomeExibicao);
    if (nomeExibicao.length > 0 && !chavesVistas.has(chave)) {
      chavesVistas.add(chave);
      resultado.push(nomeExibicao);
    }
  }
  return resultado;
}

const QUANTIDADE_INICIAIS = 2;
const SEPARADORES_NOME = /[\s._@-]+/;

// Iniciais para avatares ("maria.souza" → "MS", "Eu" → "E").
export function extrairIniciais(nome: string): string {
  return nome
    .split(SEPARADORES_NOME)
    .filter(Boolean)
    .slice(0, QUANTIDADE_INICIAIS)
    .map((parte) => parte.charAt(0).toLocaleUpperCase('pt-BR'))
    .join('');
}
