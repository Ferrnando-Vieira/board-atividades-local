export const SENHA_ADMINISTRADOR = {
  TAMANHO_MINIMO: 12,
  TAMANHO_MAXIMO: 256,
} as const;

export const USUARIO_ADMINISTRADOR = {
  TAMANHO_MINIMO: 3,
  TAMANHO_MAXIMO: 60,
  FORMATO: /^[a-z0-9._-]+$/,
} as const;

// A sessão não tem prazo fixo: cada uso empurra a validade para frente, no
// banco e no cookie. Ela só termina ao sair ou depois de DURACAO_DIAS sem
// abrir o board; 400 dias é o máximo que navegadores como Chrome e Edge
// aceitam na validade de um cookie.
export const SESSAO_ADMINISTRATIVA = {
  DURACAO_DIAS: 400,
  INTERVALO_REGISTRO_USO_MINUTOS: 5,
  NOME_COOKIE: 'board_sessao',
} as const;

export const BLOQUEIO_LOGIN = {
  TENTATIVAS_MAXIMAS: 5,
  DURACAO_MINUTOS: 15,
} as const;

export const CODIGO_CONFIGURACAO_INICIAL = {
  VALIDADE_MINUTOS: 60,
  TENTATIVAS_MAXIMAS: 5,
  BYTES_ALEATORIOS: 10,
  TAMANHO_GRUPO: 4,
} as const;

export const TOKEN_ALEATORIO_BYTES = 32;

// 32 bytes em base64url (sem preenchimento) ocupam 43 caracteres.
export const TAMANHO_TOKEN_ALEATORIO = 43;

export const OPCOES_VALIDADE_DIAS = [1, 7, 30, 90, 365] as const;

export const COMPARTILHAMENTO = {
  INTERVALO_REGISTRO_ACESSO_MINUTOS: 5,
  MAXIMO_ITENS_ESCOPO: 200,
} as const;

// O prefixo identifica o token em vazamentos (busca por "bat_") e na
// listagem; os caracteres visíveis guardados no banco não bastam para usá-lo.
export const TOKEN_API = {
  PREFIXO: 'bat_',
  CARACTERES_VISIVEIS: 8,
  INTERVALO_REGISTRO_USO_MINUTOS: 5,
} as const;
