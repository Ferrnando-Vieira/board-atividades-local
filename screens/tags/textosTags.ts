export const textosTags = {
  titulo: 'Tags',
  descricao:
    'Tags classificam as atividades e podem ser usadas em várias delas. Nomes que só diferem por acento, maiúsculas ou espaços são a mesma tag. Cada tag pode definir um solicitante padrão para as atividades salvas sem solicitante. Excluir uma tag não apaga atividades.',
  tituloNova: 'Nova tag',
  rotuloNome: 'Nome',
  botaoCriar: 'Criar tag',
  botaoCriando: 'Criando…',
  botaoSalvar: 'Salvar',
  botaoSalvando: 'Salvando…',
  rotuloCor: 'Cor',
  semCor: 'Sem cor (chip neutro)',
  rotuloSolicitantePadrao: 'Solicitante padrão (opcional)',
  dicaSolicitantePadrao:
    'Gravado quando uma atividade com esta tag é salva sem solicitante. Se a atividade tiver várias tags com padrão, vale a adicionada primeiro. Em branco, a tag não define solicitante.',
  rotuloSolicitanteDaTag: (nome: string) => `Solicitante padrão da tag ${nome}`,
  descreverSolicitantePadrao: (nome: string) => `Solicitante padrão: ${nome}`,
  botaoExcluir: 'Excluir',
  botaoExcluindo: 'Excluindo…',
  botaoCancelar: 'Cancelar',
  vazio:
    'Nenhuma tag cadastrada. Crie uma aqui ou adicione tags ao salvar uma atividade.',
  rotuloLista: 'Tags cadastradas',
  rotuloRenomear: (nome: string) => `Nome da tag ${nome}`,
  rotuloCorDaTag: (nome: string) => `Cor da tag ${nome}`,
  descreverUso: (quantidade: number) =>
    quantidade === 1
      ? 'Usada em 1 atividade'
      : `Usada em ${quantidade} atividades`,
  tituloExclusao: (nome: string) => `Excluir a tag "${nome}"?`,
  descreverExclusao: (quantidade: number) =>
    quantidade === 0
      ? 'A tag não está em nenhuma atividade. A exclusão não pode ser desfeita.'
      : `A tag será removida de ${quantidade} ${quantidade === 1 ? 'atividade' : 'atividades'}. As atividades continuam existindo. A exclusão não pode ser desfeita.`,
} as const;
