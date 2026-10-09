export const PRIORIDADE = {
  MAIS_ALTA: 0,
  MAIS_BAIXA: 9,
  PADRAO: 5,
} as const;

export const FUSO_HORARIO_PADRAO = 'America/Sao_Paulo';

export const BOARD_PADRAO = {
  chave: 'principal',
  nome: 'Board de atividades',
} as const;

export const STATUS_INICIAIS = [
  { chave: 'a-fazer', nome: 'A Fazer', finalizaAtividade: false },
  { chave: 'em-andamento', nome: 'Em Andamento', finalizaAtividade: false },
  { chave: 'bloqueados', nome: 'Bloqueados', finalizaAtividade: false },
  { chave: 'concluidos', nome: 'Concluídos', finalizaAtividade: true },
] as const;

export type ChaveStatusInicial = (typeof STATUS_INICIAIS)[number]['chave'];

export const SITUACOES_LEMBRETE = [
  'pendente',
  'disparado',
  'cancelado',
] as const;

export type SituacaoLembrete = (typeof SITUACOES_LEMBRETE)[number];

// Cada valor vira literal em CHECK no banco (migração 0006): incluir um tipo
// ou uma origem novos exige nova migração. Lembretes não entram no histórico:
// são avisos pessoais do administrador, e o histórico é visto também pelos
// links.
export const TIPOS_EVENTO_HISTORICO = [
  'criacao',
  'edicao',
  'movimento',
  'tags',
  'arquivamento',
  'restauracao',
  'anexo-adicionado',
  'anexo-removido',
] as const;

export type TipoEventoHistorico = (typeof TIPOS_EVENTO_HISTORICO)[number];

// Quem fez a alteração: a sessão do administrador (painel), um link
// completo, um token da API (inclusive o MCP) ou um script de manutenção.
export const ORIGENS_ALTERACAO = ['painel', 'link', 'api', 'sistema'] as const;

export type TipoOrigemAlteracao = (typeof ORIGENS_ALTERACAO)[number];

export const CAMPOS_HISTORICO = [
  'titulo',
  'descricao',
  'prioridade',
  'status',
  'solicitante',
  'tags',
  'prazo',
  'conclusao',
  'anexo',
] as const;

export type CampoHistorico = (typeof CAMPOS_HISTORICO)[number];

// A tela mostra os eventos mais recentes; os mais antigos continuam gravados.
export const HISTORICO = {
  MAXIMO_EVENTOS_EXIBIDOS: 200,
} as const;

// A sincronização roda só com o board aberto no navegador do proprietário.
// Disparo com mais que a tolerância depois do horário é exibido como
// atrasado (por exemplo, o board estava fechado no horário do lembrete).
export const LEMBRETES = {
  INTERVALO_SINCRONIZACAO_SEGUNDOS: 30,
  INTERVALO_VIGIA_SEGUNDOS: 10,
  TOLERANCIA_ATRASO_MINUTOS: 2,
  MAXIMO_NOTIFICACOES_LISTADAS: 50,
  MAXIMO_PROXIMOS_LISTADOS: 20,
  MAXIMO_CHAVES_EXIBIDAS_REGISTRADAS: 200,
} as const;

// Cada código vira valor permitido em CHECK no banco, então incluir uma
// permissão nova exige nova migração.
export const PERMISSOES_API = [
  'board:ler',
  'board:escrever',
  'atividades:ler',
  'atividades:escrever',
  'anexos:ler',
  'anexos:escrever',
] as const;

export type PermissaoApi = (typeof PERMISSOES_API)[number];

export const PERMISSOES_API_OFERECIDAS = [
  'board:ler',
  'board:escrever',
  'atividades:ler',
  'atividades:escrever',
  'anexos:ler',
  'anexos:escrever',
] as const satisfies readonly PermissaoApi[];

export type PermissaoApiOferecida = (typeof PERMISSOES_API_OFERECIDAS)[number];

// "completo" vê e edita o board inteiro (sem administrar links, tokens nem
// credenciais); "restrito" é somente leitura e filtrado por tags/solicitantes.
export const MODALIDADES_COMPARTILHAMENTO = ['completo', 'restrito'] as const;

export type ModalidadeCompartilhamento =
  (typeof MODALIDADES_COMPARTILHAMENTO)[number];

export const LIMITES_TEXTO = {
  NOME_BOARD: 120,
  NOME_STATUS: 60,
  TITULO_ATIVIDADE: 300,
  DESCRICAO_ATIVIDADE: 20000,
  NOME_TAG: 60,
  NOME_SOLICITANTE: 120,
  NOME_ARQUIVO_ANEXO: 255,
  NOME_LINK_COMPARTILHAMENTO: 120,
  NOME_TOKEN_API: 120,
  TERMO_BUSCA: 120,
  TITULO_LEMBRETE: 120,
  OBSERVACAO_LEMBRETE: 500,
  AUTOR_HISTORICO: 120,
} as const;

export const LIMITES_COLECAO = {
  TAGS_POR_ATIVIDADE: 20,
  ITENS_POR_ORDENACAO: 10000,
} as const;

export const VALOR_CAMPO_MARCADO = 'sim';
