import type { CorNomeada } from '@/config/aparenciaBoard';

// Cor do chip neutro do tema (fundo do tema), mostrada no seletor enquanto
// a tag está sem cor.
export const COR_TAG_NEUTRA = '#f4f6f3';

// Paleta sugerida para tags: tons claros (texto escuro) e alguns fortes
// (texto claro). A cor do texto do chip é calculada pelo contraste, então
// qualquer cor livre escolhida no seletor também fica legível.
export const CORES_SUGERIDAS_TAG: readonly CorNomeada[] = [
  { cor: '#e5e7eb', nome: 'Cinza' },
  { cor: '#fecaca', nome: 'Vermelho-claro' },
  { cor: '#fed7aa', nome: 'Laranja-claro' },
  { cor: '#fde68a', nome: 'Amarelo' },
  { cor: '#d9f99d', nome: 'Lima' },
  { cor: '#bbf7d0', nome: 'Verde-claro' },
  { cor: '#a5f3fc', nome: 'Ciano' },
  { cor: '#bfdbfe', nome: 'Azul-claro' },
  { cor: '#ddd6fe', nome: 'Lilás' },
  { cor: '#fbcfe8', nome: 'Rosa' },
  { cor: '#dc2626', nome: 'Vermelho' },
  { cor: '#2563eb', nome: 'Azul' },
  { cor: '#16a34a', nome: 'Verde' },
  { cor: '#7c3aed', nome: 'Roxo' },
];
