export const textosArquivadas = {
  titulo: 'Atividades arquivadas',
  descricao:
    'Atividades arquivadas saem do quadro, mas continuam guardadas. Restaurar devolve a atividade ao fim do seu status.',
  descricaoLeitura:
    'Atividades arquivadas saem do quadro, mas continuam guardadas.',
  vazio: 'Nenhuma atividade arquivada.',
  verDetalhes: 'Ver detalhes',
  rotuloStatus: 'Status',
  descreverArquivamento: (momento: string) => `Arquivada em ${momento}`,
  descreverQuantidade: (quantidade: number) =>
    quantidade === 1
      ? '1 atividade arquivada'
      : `${quantidade} atividades arquivadas`,
} as const;
