import type { Aviso } from '@/config/rotas';

export const textosAplicacao = {
  titulo: 'Board de atividades',
  descricao: 'Board local de atividades com administração protegida.',
  carregando: 'Carregando…',
  erroTitulo: 'Algo deu errado',
  erroDescricao:
    'Não foi possível concluir esta operação. Tente novamente; se persistir, verifique os registros do servidor.',
  erroTentarNovamente: 'Tentar novamente',
  naoEncontradaTitulo: 'Página não encontrada',
  naoEncontradaDescricao:
    'O endereço não existe ou o item foi removido. Volte ao quadro para continuar.',
  voltarAoQuadro: 'Voltar ao quadro',
  rotuloNavegacao: 'Navegação principal',
  sessaoDe: 'Conectado como',
  botaoSair: 'Sair',
  rotuloMenuConta: 'Abrir o menu da conta',
  proprietario: 'Proprietário do board',
  irParaInicio: 'Ir para o quadro',
  fecharAviso: 'Fechar aviso',
  boardAusente:
    'O board ainda não foi criado. No servidor, execute "npm run inicializar".',
  acessoCompartilhado: 'Link compartilhado',
  modalidades: {
    completo: 'Pode ver e editar',
    restrito: 'Somente leitura',
  },
  camposDataHora: {
    dicaSugestao:
      'Valores em cinza são só sugestões: clique no campo para usar. Se não mexer, nada é salvo.',
    escolhaObrigatoria:
      'Clique na data ou na hora para usar a sugestão, ou escolha outro horário.',
    limpar: 'Limpar',
  },
} as const;

// As primeiras ficam na barra de navegação; as de configuração (solicitantes,
// aparência e integrações), no menu da conta do proprietário.
export const SECOES_PAINEL = [
  'quadro',
  'busca',
  'arquivadas',
  'status',
  'tags',
  'lembretes',
  'solicitantes',
  'aparencia',
  'integracoes',
] as const;

export type SecaoPainel = (typeof SECOES_PAINEL)[number];

export const SECOES_MENU_CONTA = [
  'solicitantes',
  'aparencia',
  'integracoes',
] as const satisfies readonly SecaoPainel[];

export const textosSecoes: Record<SecaoPainel, string> = {
  quadro: 'Quadro',
  busca: 'Busca',
  arquivadas: 'Arquivadas',
  status: 'Status',
  tags: 'Tags',
  lembretes: 'Lembretes',
  solicitantes: 'Solicitantes',
  integracoes: 'Integrações',
  aparencia: 'Aparência',
};

export const textosAvisos: Record<Aviso, string> = {
  'atividade-criada': 'Atividade criada.',
  'atividade-salva': 'Alterações salvas.',
  'atividade-arquivada':
    'Atividade arquivada. Ela continua disponível na tela de arquivadas.',
  'atividade-restaurada':
    'Atividade restaurada no seu status, na posição da ordem automática.',
  'status-excluido':
    'Status excluído. Nenhuma atividade foi apagada: as que existiam foram movidas para o destino escolhido.',
  'tag-excluida':
    'Tag excluída. As atividades continuam existindo, apenas sem essa tag.',
};
