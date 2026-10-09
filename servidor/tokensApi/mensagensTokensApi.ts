import { LIMITES_TEXTO } from '@/config/constantes';

export const mensagensTokensApi = {
  nomeObrigatorio:
    'Informe um nome para identificar o token (por exemplo, o agente que vai usá-lo).',
  nomeLongo: `O nome pode ter no máximo ${LIMITES_TEXTO.NOME_TOKEN_API} caracteres.`,
  permissoesObrigatorias: 'Escolha ao menos uma permissão.',
  permissaoInvalida: 'Uma das permissões escolhidas não existe.',
  validadeInvalida: 'Escolha uma das validades da lista.',
  tokenInexistente: 'Token de API não encontrado.',
  dadosInvalidos:
    'Os dados enviados são inválidos. Recarregue a página e tente novamente.',
  corrijaCampos: 'Corrija os campos destacados.',
  tokenCriado:
    'Token gerado. Copie-o agora: por segurança, ele não será exibido de novo.',
  tokenRevogado:
    'Token revogado. Requisições com ele passam a ser recusadas imediatamente.',
} as const;
