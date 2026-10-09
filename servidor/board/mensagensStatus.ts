import { LIMITES_COLECAO, LIMITES_TEXTO } from '@/config/constantes';

export const mensagensStatus = {
  boardAusente:
    'O board ainda não foi criado. No servidor, execute "npm run inicializar".',
  statusInexistente:
    'O status escolhido não existe mais. Recarregue a página e escolha outro.',
  nomeObrigatorio: 'Informe o nome do status.',
  corInvalida: 'Escolha uma cor válida (formato #rrggbb) ou use a cor padrão.',
  nomeLongo: `O nome do status pode ter no máximo ${LIMITES_TEXTO.NOME_STATUS} caracteres.`,
  nomeRepetido: 'Já existe um status com esse nome.',
  statusAlterado:
    'Este status foi alterado por outra operação. Recarregue a página e tente novamente.',
  ordemAlterada:
    'A ordem das colunas foi alterada por outra operação. Recarregue a página e tente novamente.',
  ultimoStatus:
    'O board precisa ter pelo menos um status. Crie outro antes de excluir este.',
  destinoObrigatorio:
    'Este status tem atividades. Escolha o status que vai recebê-las.',
  destinoInvalido:
    'Escolha um status de destino diferente do status que será excluído.',
  usadoEmCompartilhamento:
    'Este status faz parte do escopo de um link de compartilhamento e não pode ser excluído.',
  dadosInvalidos:
    'Os dados enviados são inválidos. Recarregue a página e tente novamente.',
  corrijaCampos: 'Corrija os campos destacados.',
  statusCriado: 'Status criado no fim do quadro.',
  statusSalvo: 'Status salvo.',
  posicaoInvalida: `Informe a posição como um número inteiro de 0 a ${LIMITES_COLECAO.ITENS_POR_ORDENACAO}.`,
} as const;
