import {
  LIMITES_COLECAO,
  LIMITES_TEXTO,
  PRIORIDADE,
} from '@/config/constantes';

export const mensagensAtividades = {
  tituloObrigatorio: 'Informe o título da atividade.',
  tituloLongo: `O título pode ter no máximo ${LIMITES_TEXTO.TITULO_ATIVIDADE} caracteres.`,
  descricaoLonga: `A descrição pode ter no máximo ${LIMITES_TEXTO.DESCRICAO_ATIVIDADE} caracteres.`,
  prioridadeInvalida: `Escolha uma prioridade de ${PRIORIDADE.MAIS_ALTA} (mais alta) a ${PRIORIDADE.MAIS_BAIXA} (mais baixa).`,
  statusObrigatorio: 'Escolha o status da atividade.',
  solicitanteLongo: `O solicitante pode ter no máximo ${LIMITES_TEXTO.NOME_SOLICITANTE} caracteres.`,
  tagLonga: `Cada tag pode ter no máximo ${LIMITES_TEXTO.NOME_TAG} caracteres.`,
  tagsDemais: `Uma atividade pode ter no máximo ${LIMITES_COLECAO.TAGS_POR_ATIVIDADE} tags.`,
  dataInvalida: 'Informe uma data válida.',
  horaInvalida: 'Informe a hora no formato HH:MM.',
  horaSemData: 'Informe a data para usar a hora.',
  dadosInvalidos:
    'Os dados enviados são inválidos. Recarregue a página e tente novamente.',
  corrijaCampos: 'Corrija os campos destacados.',
  atividadeInexistente: 'Atividade não encontrada.',
  atividadeAlterada:
    'Esta atividade foi alterada por outra operação. Recarregue a página para ver a versão atual e tente novamente.',
  atividadeArquivada:
    'A atividade está arquivada. Restaure-a antes de alterá-la.',
  atividadeNaoArquivada: 'A atividade não está arquivada.',
  colunaAlterada:
    'A coluna foi alterada por outra operação. Recarregue a página e tente novamente.',
  posicaoInvalida: `Informe a posição como um número inteiro de 0 a ${LIMITES_COLECAO.ITENS_POR_ORDENACAO}.`,
  atividadeCriada: 'Atividade criada.',
  atividadeSalva: 'Alterações salvas.',
} as const;
