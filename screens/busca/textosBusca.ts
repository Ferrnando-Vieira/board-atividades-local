export const textosBusca = {
  titulo: 'Busca',
  descricao:
    'Procura no título, na descrição, no solicitante e nas tags, sem diferença de acento nem de maiúsculas.',
  rotuloCampo: 'Buscar atividades',
  placeholder: 'Buscar atividades',
  botaoBuscar: 'Buscar',
  orientacao: 'Digite uma ou mais palavras para buscar.',
  semResultados: 'Nenhuma atividade encontrada.',
  arquivada: 'Arquivada',
  rotuloStatus: 'Status',
  descreverQuantidade: (quantidade: number) =>
    quantidade === 1
      ? '1 atividade encontrada'
      : `${quantidade} atividades encontradas`,
} as const;
