import type { NivelPrioridade } from '@/util/PrioridadeUtils';

// Opacidade em porcentagem inteira (o banco guarda 0 a 100); o controle anda
// de 5 em 5 para a escolha não virar ajuste fino invisível.
export const LIMITES_OPACIDADE = {
  MINIMA: 0,
  MAXIMA: 100,
  PASSO: 5,
} as const;

// "automatico" escolhe texto escuro ou claro pelo contraste com o fundo; os
// outros dois deixam o proprietário fixar a cor do texto.
export const MODOS_TOM_TEXTO = ['automatico', 'escuro', 'claro'] as const;

export type ModoTomTexto = (typeof MODOS_TOM_TEXTO)[number];

export type SuperficiesBoard = {
  corTitulos: string;
  corColunas: string;
  opacidadeTitulos: number;
  opacidadeColunas: number;
  tomTexto: ModoTomTexto;
};

// Títulos em branco e corpo das colunas no tom do fundo do tema, ambos quase
// opacos: com qualquer fundo pronto o texto escuro do tema mantém AA.
export const SUPERFICIES_PADRAO = {
  corTitulos: '#ffffff',
  corColunas: '#f4f6f3',
  opacidadeTitulos: 90,
  opacidadeColunas: 90,
  tomTexto: 'automatico',
} as const satisfies SuperficiesBoard;

export const NIVEIS_PRIORIDADE = [
  'critica',
  'alta',
  'media',
  'baixa',
] as const satisfies readonly NivelPrioridade[];

export type CoresPrioridade = Record<NivelPrioridade, string>;

// Crítica e alta chamam atenção; média (a maioria dos cartões) e baixa ficam
// discretas para o quadro não virar um mosaico de cores.
export const CORES_PRIORIDADE_PADRAO = {
  critica: '#b42318',
  alta: '#f0a020',
  media: '#d3e4cf',
  baixa: '#e6e9e4',
} as const satisfies CoresPrioridade;

export type CorNomeada = {
  cor: string;
  nome: string;
};

// Sugestões rápidas nos seletores de cor das superfícies (claras e escuras,
// para combinar com fundos claros ou escuros).
export const CORES_SUGERIDAS_SUPERFICIE: readonly CorNomeada[] = [
  { cor: '#ffffff', nome: 'Branco' },
  { cor: '#f4f6f3', nome: 'Gelo esverdeado' },
  { cor: '#eef2ff', nome: 'Lavanda clara' },
  { cor: '#e0f2fe', nome: 'Céu claro' },
  { cor: '#ecfdf5', nome: 'Menta clara' },
  { cor: '#fef3c7', nome: 'Areia' },
  { cor: '#fde2e4', nome: 'Rosa claro' },
  { cor: '#1f2937', nome: 'Grafite' },
  { cor: '#0f2a1d', nome: 'Verde-noite' },
  { cor: '#1e1b4b', nome: 'Índigo escuro' },
  { cor: '#111111', nome: 'Preto' },
];

export const CORES_SUGERIDAS_PRIORIDADE: readonly CorNomeada[] = [
  { cor: '#b42318', nome: 'Vermelho' },
  { cor: '#c2410c', nome: 'Laranja' },
  { cor: '#f0a020', nome: 'Âmbar' },
  { cor: '#facc15', nome: 'Amarelo' },
  { cor: '#237032', nome: 'Verde' },
  { cor: '#d3e4cf', nome: 'Verde-claro' },
  { cor: '#1971c2', nome: 'Azul' },
  { cor: '#7048e8', nome: 'Violeta' },
  { cor: '#e6e9e4', nome: 'Cinza-claro' },
  { cor: '#495057', nome: 'Cinza-escuro' },
];
