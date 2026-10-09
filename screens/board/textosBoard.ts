import { LIMITES_COLECAO } from '@/config/constantes';

export const textosBoard = {
  tituloOculto: (nomeBoard: string) => `Quadro: ${nomeBoard}`,
  rotuloFerramentas: 'Ferramentas do quadro',
  rotuloSolicitante: 'Solicitante:',
  rotuloPrazo: 'Prazo:',
  novaAtividade: 'Nova atividade',
  tituloModalNova: 'Nova atividade',
  descricaoModalNova:
    'A posição no quadro é automática: prioridade (0 primeiro) e, no empate, a data de abertura.',
  fecharModal: 'Fechar',
  tituloDescarte: 'Descartar a nova atividade?',
  descricaoDescarte:
    'Os dados preenchidos ainda não foram salvos e serão perdidos.',
  confirmarDescarte: 'Descartar',
  descartando: 'Descartando…',
  continuarEditando: 'Continuar editando',
  criadaOculta: 'Ela pode estar oculta pelos filtros ativos.',
  descricaoSomenteLeitura:
    'Visualização somente leitura: abra um cartão para ver os detalhes.',
  colunaVazia: 'Nenhuma atividade nesta coluna.',
  colunaVaziaFiltrada: 'Nenhuma atividade atende aos filtros nesta coluna.',
  concluiAtividade: 'Conclui',
  descricaoConclui: 'Atividades neste status recebem data de conclusão.',
  instrucoesArraste:
    'Arraste o cartão (no celular, toque e segure) para mudar o status. Com o teclado, pressione Espaço ou Enter na alça, use as setas para a esquerda e a direita para escolher a coluna e pressione Espaço ou Enter de novo para soltar; Esc cancela. Dentro da coluna a posição é automática, pela prioridade e pela data de abertura.',
  salvando: 'Salvando…',
  salvo: 'Alterações salvas.',
  atalhoNovaAtividade: 'Nova atividade (atalho: N)',
  filtrosSemResultado: 'Nenhuma atividade atende aos filtros escolhidos.',
  falhaMovimento:
    'O movimento não foi salvo. O quadro já mostra a versão gravada; refaça-o, se ainda for necessário.',
  conflitoMovimento:
    'O quadro foi alterado em outra janela ou por outra pessoa e já foi atualizado. Refaça o movimento, se ainda for necessário.',
  fecharAviso: 'Fechar aviso',
  destinoArraste: 'Soltar aqui',
  alcaCartao: (titulo: string) => `Mover a atividade "${titulo}"`,
  alcaColuna: (nome: string) => `Mover a coluna ${nome}`,
  listaDaColuna: (nome: string) => `Atividades em ${nome}`,
  descreverQuantidade: (quantidade: number) =>
    quantidade === 1 ? '1 atividade' : `${quantidade} atividades`,
  filtros: {
    botao: 'Filtros',
    rotuloRegiao: 'Filtros do quadro',
    legendaPrioridades: 'Prioridade',
    legendaTags: 'Tags',
    legendaSolicitantes: 'Solicitantes',
    semTags: 'Nenhuma tag nos cartões exibidos.',
    semSolicitantes: 'Nenhum solicitante nos cartões exibidos.',
    dica: 'Dentro de cada grupo vale qualquer item marcado; entre grupos, todos precisam ser atendidos. Clicar numa tag do cartão também liga ou desliga o filtro.',
    limpar: 'Limpar filtros',
    rotuloAtivos: 'Filtros ativos',
    removerFiltro: (descricao: string) => `Remover o filtro ${descricao}`,
    descreverTag: (nome: string) => `tag ${nome}`,
    descreverSolicitante: (nome: string) => `solicitante ${nome}`,
    descreverPrioridade: (prioridade: number) => `prioridade ${prioridade}`,
    descreverResultado: (visiveis: number, total: number) =>
      `Exibindo ${visiveis} de ${total} ${total === 1 ? 'atividade' : 'atividades'}.`,
    filtrarPorTag: (nome: string) => `Filtrar pela tag ${nome}`,
  },
  tagsRapidas: {
    abrir: (titulo: string) => `Gerenciar as tags de "${titulo}"`,
    titulo: 'Tags do cartão',
    rotuloBusca: 'Buscar ou criar tag',
    dicaBusca: 'Digite para filtrar; Enter adiciona a primeira opção.',
    vinculadas: 'Neste cartão',
    semVinculadas: 'Nenhuma tag neste cartão.',
    sugestoes: 'Adicionar',
    semSugestoes: 'Nenhuma outra tag encontrada.',
    criar: (nome: string) => `Criar a tag "${nome}"`,
    remover: (nome: string) => `Remover a tag ${nome} deste cartão`,
    fechar: 'Fechar',
    salvando: 'Salvando…',
    limite: `Este cartão já tem ${LIMITES_COLECAO.TAGS_POR_ATIVIDADE} tags, o máximo permitido. Remova uma para adicionar outra.`,
  },
  anuncios: {
    pegouCartao: (
      titulo: string,
      posicao: number,
      total: number,
      coluna: string,
    ) =>
      `"${titulo}" selecionada na posição ${posicao} de ${total} em ${coluna}. Use as setas para escolher o destino.`,
    moveuCartao: (posicao: number, total: number, coluna: string) =>
      `Posição ${posicao} de ${total} em ${coluna}.`,
    soltouCartao: (titulo: string, posicao: number, coluna: string) =>
      `"${titulo}" movida para a posição ${posicao} em ${coluna}.`,
    cancelouCartao: (titulo: string) => `Movimento de "${titulo}" cancelado.`,
    pegouColuna: (nome: string, posicao: number, total: number) =>
      `Coluna ${nome} selecionada na posição ${posicao} de ${total}. Use as setas para escolher o destino.`,
    moveuColuna: (posicao: number, total: number) =>
      `Posição ${posicao} de ${total}.`,
    soltouColuna: (nome: string, posicao: number) =>
      `Coluna ${nome} movida para a posição ${posicao}.`,
    cancelouColuna: (nome: string) => `Movimento da coluna ${nome} cancelado.`,
  },
} as const;
