import { LIMITES_TEXTO } from '@/config/constantes';

export const mensagensTags = {
  nomeObrigatorio: 'Informe o nome da tag.',
  nomeLongo: `O nome da tag pode ter no máximo ${LIMITES_TEXTO.NOME_TAG} caracteres.`,
  nomeRepetido: 'Já existe uma tag com esse nome.',
  tagInexistente: 'Tag não encontrada. Ela pode ter sido excluída.',
  tagAlterada:
    'Esta tag foi alterada por outra operação. Recarregue a página e tente novamente.',
  usadaEmCompartilhamento:
    'Esta tag faz parte do escopo de um link de compartilhamento e não pode ser excluída.',
  dadosInvalidos:
    'Os dados enviados são inválidos. Recarregue a página e tente novamente.',
  solicitanteLongo: `O nome do solicitante pode ter no máximo ${LIMITES_TEXTO.NOME_SOLICITANTE} caracteres.`,
  corInvalida:
    'Escolha uma cor válida (formato #rrggbb) ou deixe a tag neutra.',
  corrijaCampos: 'Corrija os campos destacados.',
  tagCriada: 'Tag criada.',
  tagAtualizada: 'Tag atualizada.',
} as const;
