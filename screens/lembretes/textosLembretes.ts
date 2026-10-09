import type { SituacaoNotificacoesNavegador } from '@/screens/lembretes/notificacoesNavegador';

export const textosLembretes = {
  botaoCentral: 'Lembretes',
  descreverBotaoCentral: (quantidade: number) =>
    quantidade === 0
      ? 'Lembretes: nenhum aguardando leitura'
      : `Lembretes: ${quantidade} aguardando leitura`,
  tituloCentral: 'Lembretes',
  rotuloAbas: 'Listas de lembretes',
  abaAvisos: 'Avisos',
  abaProximos: 'Próximos',
  nenhumAviso: 'Nenhum lembrete aguardando leitura.',
  nenhumProximo: 'Nenhum lembrete marcado para os próximos dias.',
  origens: { atividade: 'Atividade', avulso: 'Lembrete' },
  novoLembrete: 'Novo lembrete',
  fecharNovoLembrete: 'Cancelar',
  verTodos: 'Ver todos os lembretes',
  tituloPagina: 'Lembretes',
  descricaoPagina:
    'Avisos com data e hora, com ou sem atividade. Os lembretes de uma atividade são criados no detalhe dela; aqui você cria lembretes avulsos e acompanha todos.',
  tituloNovo: 'Novo lembrete avulso',
  tituloProximos: 'Próximos',
  tituloAvulsos: 'Lembretes avulsos',
  semAvulsos: 'Nenhum lembrete avulso ainda. Crie um acima.',
  rotuloTitulo: 'Título',
  placeholderTitulo: 'Ex.: ligar para o fornecedor',
  rotuloObservacao: 'Observação (opcional)',
  rotuloData: 'Data',
  rotuloHora: 'Hora',
  botaoCriar: 'Criar lembrete',
  botaoCriando: 'Criando…',
  botaoSalvar: 'Salvar',
  botaoSalvando: 'Salvando…',
  botaoEditar: 'Editar',
  botaoFecharEdicao: 'Fechar edição',
  botaoCancelarLembrete: 'Desativar',
  botaoReativar: 'Reativar',
  botaoExcluir: 'Excluir',
  botaoExcluindo: 'Excluindo…',
  tituloExclusao: (titulo: string) => `Excluir o lembrete "${titulo}"?`,
  confirmacaoExclusao: 'O lembrete é apagado e não pode ser recuperado.',
  cancelar: 'Cancelar',
  situacoes: {
    pendente: 'Agendado',
    disparado: 'Disparado',
    cancelado: 'Desativado',
  },
  dispensado: 'lido',
  descreverEdicao: (titulo: string) => `Editar o lembrete ${titulo}`,
  dispensar: 'Dispensar',
  descreverDispensa: (titulo: string) => `Dispensar o lembrete de ${titulo}`,
  marcadoPara: (horario: string) => `Marcado para ${horario}`,
  atrasado: 'Atrasado',
  falhaSincronizacao:
    'Não foi possível verificar os lembretes agora. Uma nova tentativa é feita em instantes.',
  falhaDispensa: 'Não foi possível dispensar o lembrete. Tente novamente.',
  limitacao:
    'Os lembretes são verificados enquanto o board está aberto neste navegador; com ele fechado, o aviso aparece como atrasado na próxima abertura.',
  fecharCentral: 'Fechar',
  ativarNotificacoes: 'Ativar notificações do navegador',
  ativandoNotificacoes: 'Aguardando permissão…',
  situacoesNavegador: {
    indisponivel:
      'Este navegador não oferece notificações do sistema. Os avisos aparecem só aqui.',
    'contexto-inseguro':
      'Notificações do sistema exigem HTTPS ou acesso por localhost. Os avisos aparecem só aqui.',
    'nao-solicitada':
      'Você também pode receber os avisos como notificações do sistema enquanto o board estiver aberto.',
    concedida: 'Notificações do navegador ativadas.',
    negada:
      'Notificações bloqueadas neste navegador. Para recebê-las, libere nas configurações do site; os avisos continuam aparecendo aqui.',
  } satisfies Record<SituacaoNotificacoesNavegador, string>,
  tituloNotificacao: (titulo: string) => `Lembrete: ${titulo}`,
  corpoNotificacao: (horario: string, atrasado: boolean) =>
    atrasado
      ? `Atrasado: estava marcado para ${horario}.`
      : `Marcado para ${horario}.`,
  anunciarNovos: (titulos: readonly string[]) =>
    titulos.length === 1
      ? `Novo lembrete: ${titulos[0]}.`
      : `${titulos.length} novos lembretes: ${titulos.join('; ')}.`,
} as const;
