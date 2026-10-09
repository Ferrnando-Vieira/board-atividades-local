import { LIMITES_TEXTO } from '@/config/constantes';
import { COMPARTILHAMENTO } from '@/config/constantesSeguranca';

export const mensagensCompartilhamento = {
  nomeObrigatorio:
    'Informe um nome para identificar o link (por exemplo, para quem ele vai).',
  nomeLongo: `O nome pode ter no máximo ${LIMITES_TEXTO.NOME_LINK_COMPARTILHAMENTO} caracteres.`,
  modalidadeInvalida: 'Escolha a modalidade do link.',
  escopoObrigatorio:
    'No link restrito, escolha ao menos uma tag ou um solicitante.',
  escopoGrande: `Escolha no máximo ${COMPARTILHAMENTO.MAXIMO_ITENS_ESCOPO} itens em cada grupo.`,
  validadeInvalida: 'Escolha uma das validades da lista.',
  animalInvalido: 'Escolha um dos animais da lista.',
  tagInexistente:
    'Uma das tags escolhidas não existe mais. Recarregue a página e escolha de novo.',
  solicitanteInexistente:
    'Um dos solicitantes escolhidos não existe mais. Recarregue a página e escolha de novo.',
  linkInexistente: 'Link de compartilhamento não encontrado.',
  dadosInvalidos:
    'Os dados enviados são inválidos. Recarregue a página e tente novamente.',
  corrijaCampos: 'Corrija os campos destacados.',
  linkCriado:
    'Link gerado. Copie-o agora: por segurança, o endereço completo não será exibido de novo.',
  linkRevogado:
    'Link revogado. Quem tinha o endereço perdeu o acesso imediatamente.',
  animalDefinido:
    'Animal do link atualizado. Quem estiver com o link aberto passa a aparecer com ele em poucos segundos.',
  linkPadraoAtivado:
    'Link de visualização ativado. Copie o endereço abaixo para compartilhar.',
  linkPadraoRenovado:
    'Novo endereço gerado. O anterior deixou de funcionar na mesma hora.',
} as const;
