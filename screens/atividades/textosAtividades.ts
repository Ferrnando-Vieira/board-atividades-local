import { PRIORIDADE, type SituacaoLembrete } from '@/config/constantes';
import type { SituacaoPrazo } from '@/util/PrazoUtils';

function complementoPrioridade(prioridade: number): string {
  if (prioridade === PRIORIDADE.MAIS_ALTA) {
    return ' (mais alta)';
  }
  if (prioridade === PRIORIDADE.PADRAO) {
    return ' (padrão)';
  }
  if (prioridade === PRIORIDADE.MAIS_BAIXA) {
    return ' (mais baixa)';
  }
  return '';
}

export const textosAtividades = {
  tituloNova: 'Nova atividade',
  tituloEdicao: 'Editar atividade',
  descricaoNova:
    'A posição no quadro é automática: prioridade (0 primeiro) e, no empate, a data de abertura.',
  rotuloTitulo: 'Título',
  rotuloDescricao: 'Descrição',
  rotuloStatus: 'Status',
  rotuloPrioridade: 'Prioridade',
  dicaPrioridade:
    '0 é a mais alta e 9 a mais baixa. A prioridade define a posição do cartão na coluna.',
  rotuloSolicitante: 'Solicitante',
  dicaSolicitante:
    'Digite livremente ou escolha um nome já usado. Em branco, fica o solicitante padrão da primeira tag que tiver um ou, sem isso, o do board.',
  dicaSolicitanteDaTag: (tag: string) =>
    `Preenchido pelo solicitante padrão da tag "${tag}". Digite outro nome para trocar.`,
  rotuloTags: 'Tags',
  dicaTags:
    'Digite e pressione Enter ou vírgula para adicionar. Tags iguais sem diferença de acento ou maiúsculas são unificadas.',
  rotuloNovaTag: 'Adicionar tag',
  botaoAdicionarTag: 'Adicionar',
  semTagsSelecionadas: 'Nenhuma tag selecionada.',
  legendaPrazo: 'Prazo',
  legendaConclusao: 'Conclusão',
  dicaConclusao:
    'Só vale em status que concluem a atividade. Em branco, registra o momento do salvamento; nos demais status, é removida.',
  rotuloData: 'Data',
  rotuloHoraOpcional: 'Hora (opcional)',
  botaoCriar: 'Criar atividade',
  botaoSalvar: 'Salvar alterações',
  botaoSalvando: 'Salvando…',
  cancelar: 'Cancelar',
  voltarQuadro: 'Voltar ao quadro',
  fecharDetalhe: 'Fechar detalhes da atividade',
  voltarArquivadas: 'Voltar às arquivadas',
  editar: 'Editar',
  tituloDescarteEdicao: 'Descartar as alterações?',
  descricaoDescarteEdicao:
    'As alterações ainda não foram salvas e serão perdidas.',
  confirmarDescarte: 'Descartar',
  descartando: 'Descartando…',
  continuarEditando: 'Continuar editando',
  arquivar: 'Arquivar',
  arquivando: 'Arquivando…',
  restaurar: 'Restaurar',
  restaurando: 'Restaurando…',
  rotuloStatusAtual: 'Status',
  rotuloPrazo: 'Prazo',
  rotuloConcluidaEm: 'Concluída em',
  rotuloLembrete: 'Lembrete',
  rotuloArquivadaEm: 'Arquivada em',
  rotuloCriadaEm: 'Criada em',
  rotuloAtualizadaEm: 'Atualizada em',
  semDescricao: 'Sem descrição.',
  semTags: 'Sem tags.',
  semPrazo: 'Sem prazo.',
  semLembrete: 'Sem lembrete.',
  atividadeArquivada:
    'Esta atividade está arquivada e não aparece no quadro. Restaure-a para editá-la ou movê-la.',
  atividadeAusente: 'Atividade não encontrada.',
  situacoesLembrete: {
    pendente: 'ativo',
    disparado: 'disparado',
    cancelado: 'desativado',
  } satisfies Record<SituacaoLembrete, string>,
  detalhesLembrete: {
    arquivadaPendente:
      'Não dispara enquanto a atividade estiver arquivada; volta a valer quando ela for restaurada.',
    pendenteVencido:
      'O horário passou sem o board aberto. O aviso aparece na próxima verificação, marcado como atrasado.',
    desativado: 'Não dispara até ser reativado.',
    desativadoVencido:
      'O horário já passou: escolha uma nova data e hora para voltar a ser avisado.',
    semMomentoDisparo:
      'Já disparado antes de ser registrado neste board, sem aviso pendente.',
    disparadoAguardando: (momento: string) =>
      `Disparado em ${momento}; aguardando leitura na central de lembretes.`,
    disparadoDispensado: (momento: string) =>
      `Disparado em ${momento} e já dispensado.`,
  },
  tituloSecaoLembrete: 'Lembrete',
  descricaoSecaoLembrete:
    'Escolha a data e a hora no fuso do board. O aviso aparece na central de lembretes e, se você permitir, como notificação do navegador, enquanto o board estiver aberto.',
  rotuloDataLembrete: 'Data do lembrete',
  rotuloHoraLembrete: 'Hora do lembrete',
  botaoSalvarLembrete: 'Salvar lembrete',
  botaoRemarcarLembrete: 'Remarcar lembrete',
  ativarLembrete: 'Reativar',
  ativandoLembrete: 'Reativando…',
  desativarLembrete: 'Desativar',
  desativandoLembrete: 'Desativando…',
  excluirLembrete: 'Excluir lembrete',
  excluindoLembrete: 'Excluindo…',
  situacoesPrazo: {
    vencido: 'Vencido',
    hoje: 'Hoje',
    proximo: 'Próximo',
    'no-prazo': 'No prazo',
  } satisfies Record<SituacaoPrazo, string>,
  niveisPrioridade: {
    critica: 'crítica',
    alta: 'alta',
    media: 'média',
    baixa: 'baixa',
  },
  descreverNivelPrioridade: (descricao: string, nivel: string) =>
    `${descricao}, criticidade ${nivel}`,
  rotuloPrioridadeCurto: (prioridade: number) => `P${prioridade}`,
  descreverPrioridade: (prioridade: number) =>
    `Prioridade ${prioridade}${complementoPrioridade(prioridade)}`,
  opcaoPrioridade: (prioridade: number) =>
    `${prioridade}${complementoPrioridade(prioridade)}`,
  removerTag: (nome: string) => `Remover a tag ${nome}`,
  rotuloAnexos: 'Anexos',
  semAnexos: 'Nenhum anexo.',
  baixarAnexo: (nome: string, tamanho: string) => `Baixar ${nome} (${tamanho})`,
  descreverEnvioAnexo: (momento: string) => `Enviado em ${momento}`,
  abrirImagemAnexo: (nome: string) => `Abrir a imagem ${nome}`,
  rotuloNovoAnexo: 'Anexar arquivos',
  dicaNovoAnexo: (
    tamanhoMaximo: string,
    quantidadeMaxima: number,
    quantidadePorEnvio: number,
  ) =>
    `Escolha ou arraste até ${quantidadePorEnvio} arquivos de cada vez, com até ${tamanhoMaximo} cada; a atividade aceita ${quantidadeMaxima} anexos, contando as imagens da descrição. Aceita PDF, imagens (PNG, JPG, GIF, WebP), texto (TXT, CSV, MD), documentos do Office ou LibreOffice e ZIP. Os arquivos ficam guardados só neste computador.`,
  soltarArquivosAqui: 'Solte os arquivos para anexar',
  arquivosEscolhidos: (quantidade: number) =>
    quantidade === 1
      ? '1 arquivo escolhido'
      : `${quantidade} arquivos escolhidos`,
  botaoEnviarAnexo: 'Enviar anexos',
  enviandoAnexo: 'Enviando…',
  removerAnexo: 'Remover',
  removendoAnexo: 'Removendo…',
  descreverRemocaoAnexo: (nome: string) => `Remover o anexo ${nome}`,
  tituloRemocaoAnexo: 'Remover anexo?',
  confirmarRemocaoAnexo: (nome: string) =>
    `O arquivo "${nome}" deixa de aparecer na atividade e é apagado do disco. Esta ação não pode ser desfeita.`,
  avisoImagemNaDescricao:
    'Esta imagem aparece na descrição e passará a ser exibida lá como indisponível.',
  anexosSomenteLeitura: 'Restaure a atividade para enviar ou remover anexos.',
  rotuloAnexosNovos: 'Anexos',
  dicaAnexosNovos: (tamanhoMaximo: string, quantidadePorEnvio: number) =>
    `Opcional. Até ${quantidadePorEnvio} arquivos (contando as imagens coladas na descrição), com até ${tamanhoMaximo} cada. São enviados quando a atividade for criada.`,
  botaoEscolherAnexos: 'Escolher arquivos',
  removerAnexoPendente: (nome: string) => `Tirar ${nome} da lista`,
  tirarDaLista: 'Tirar',
  dicaDescricao:
    'Use a barra para formatar (Markdown). Cole (Ctrl+V) ou arraste imagens para inseri-las no texto; elas são enviadas ao salvar.',
  abaEscrever: 'Escrever',
  abaVisualizar: 'Visualizar',
  rotuloModoDescricao: 'Modo de edição da descrição',
  rotuloBarraFormatacao: 'Formatação da descrição',
  visualizacaoVazia: 'Nada para visualizar.',
  formatacoes: {
    negrito: 'Negrito (Ctrl+B)',
    italico: 'Itálico (Ctrl+I)',
    tachado: 'Tachado',
    titulo: 'Título',
    lista: 'Lista com marcadores',
    listaNumerada: 'Lista numerada',
    listaTarefas: 'Lista de tarefas',
    citacao: 'Citação',
    codigo: 'Código no texto (Ctrl+E)',
    blocoCodigo: 'Bloco de código: cole o trecho dentro dele',
    link: 'Link (Ctrl+K)',
  },
  inserirImagem: 'Inserir imagem',
  textoPadraoLink: 'texto do link',
  prefixoImagemColada: 'imagem-colada',
  soltarImagensAqui: 'Solte as imagens para inserir',
  imagemIndisponivel: (nome: string) =>
    nome === '' ? 'Imagem indisponível' : `Imagem indisponível: ${nome}`,
  imagemExterna: (nome: string) =>
    nome === '' ? 'Imagem externa' : `Imagem externa: ${nome}`,
  apenasImagensNaDescricao:
    'Só imagens PNG, JPG, GIF ou WebP podem ser coladas na descrição. Anexe os demais arquivos na seção de anexos.',
  copiarCodigo: 'Copiar',
  rotuloCopiarCodigo: 'Copiar o código',
  codigoCopiado: 'Código copiado.',
  codigoSelecionado: 'Código selecionado: pressione Ctrl+C para copiar.',
  rotuloHistorico: 'Histórico de alterações',
  resumoHistorico: (quantidade: number) =>
    quantidade === 1 ? '1 registro' : `${quantidade} registros`,
  semHistorico:
    'Nenhuma alteração registrada. O histórico começa a contar a partir desta versão do board.',
  historicoLimitado: (exibidos: number, total: number) =>
    `Mostrando os ${exibidos} registros mais recentes de ${total}.`,
  eventosHistorico: {
    criacao: 'criou a atividade',
    edicao: 'editou',
    movimento: 'moveu no quadro',
    tags: 'alterou as tags',
    arquivamento: 'arquivou',
    restauracao: 'restaurou',
    'anexo-adicionado': 'anexou',
    'anexo-removido': 'removeu o anexo',
  },
  camposHistorico: {
    titulo: 'Título',
    descricao: 'Descrição',
    prioridade: 'Prioridade',
    status: 'Status',
    solicitante: 'Solicitante',
    tags: 'Tags',
    prazo: 'Prazo',
    conclusao: 'Conclusão',
    anexo: 'Arquivo',
  },
  // Quem vê o painel do administrador vê o nome do link ou do token; pelos
  // links aparece só a origem.
  origensHistorico: {
    painel: 'Administrador',
    link: 'Link compartilhado',
    api: 'Integração (API)',
    sistema: 'Sistema',
  },
  autoresHistorico: {
    painel: (autor: string) => `Administrador (${autor})`,
    link: (autor: string) => `Link “${autor}”`,
    api: (autor: string) => `API “${autor}”`,
    sistema: () => 'Sistema',
  },
  valorVazioHistorico: 'vazio',
  descreverAlteracaoHistorico: (campo: string, antes: string, depois: string) =>
    `${campo}: ${antes} → ${depois}`,
  descricaoAlterada: 'Descrição alterada',
  verDescricaoAnterior: 'Ver antes e depois',
  descricaoAntes: 'Antes',
  descricaoDepois: 'Depois',
  descreverSolicitante: (nome: string) => `Solicitante: ${nome}`,
  descreverPrazo: (prazo: string) => `Prazo: ${prazo}`,
  descreverLembrete: (momento: string, situacao: string) =>
    `${momento} (${situacao})`,
} as const;
