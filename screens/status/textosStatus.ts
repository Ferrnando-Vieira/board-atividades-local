export const textosStatus = {
  titulo: 'Status do quadro',
  descricao:
    'Cada status é uma coluna do quadro, na ordem desta lista. Excluir um status nunca apaga atividades: as que existirem, inclusive arquivadas, vão para o status de destino escolhido.',
  tituloNovo: 'Novo status',
  rotuloNome: 'Nome',
  rotuloFinaliza: 'Conclui a atividade',
  legendaCores: 'Cores da coluna',
  rotuloCorTitulo: 'Fundo do título',
  rotuloCorColuna: 'Fundo da coluna',
  usarCorPadrao: 'Usar a cor padrão',
  previaNome: 'Nova coluna',
  dicaCores:
    'Sem cor própria, a coluna usa as cores e transparências definidas em Aparência. A cor do texto se ajusta sozinha.',
  dicaFinaliza:
    'Atividades que entram neste status recebem data de conclusão; ao sair para um status que não conclui, a data é removida. Mudar esta opção não altera as atividades que já estão no status.',
  botaoCriar: 'Criar status',
  botaoCriando: 'Criando…',
  botaoSalvar: 'Salvar',
  botaoSalvando: 'Salvando…',
  botaoExcluir: 'Excluir',
  botaoExcluindo: 'Excluindo…',
  botaoCancelar: 'Cancelar',
  botaoAntes: 'Antes',
  botaoDepois: 'Depois',
  rotuloDestino: 'Mover as atividades para',
  ultimoStatus: 'O board precisa de pelo menos um status.',
  reordenando: 'Salvando a nova ordem…',
  moverAntes: (nome: string) => `Mover o status ${nome} uma posição antes`,
  moverDepois: (nome: string) => `Mover o status ${nome} uma posição depois`,
  tituloExclusao: (nome: string) => `Excluir o status "${nome}"?`,
  descreverConteudo: (ativas: number, arquivadas: number) =>
    `${ativas} ${ativas === 1 ? 'ativa' : 'ativas'} e ${arquivadas} ${arquivadas === 1 ? 'arquivada' : 'arquivadas'}`,
  exclusaoComAtividades: (quantidade: number) =>
    `Este status tem ${quantidade} ${quantidade === 1 ? 'atividade' : 'atividades'}. Nenhuma será apagada: escolha o status que vai recebê-las.`,
  exclusaoSemAtividades:
    'Este status não tem atividades. A exclusão não pode ser desfeita.',
} as const;
