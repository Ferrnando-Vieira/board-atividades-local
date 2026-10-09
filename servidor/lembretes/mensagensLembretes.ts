import { LIMITES_TEXTO } from '@/config/constantes';

export const mensagensLembretes = {
  dataObrigatoria: 'Informe uma data válida para o lembrete.',
  horaObrigatoria: 'Informe a hora do lembrete no formato HH:MM.',
  lembreteNoPassado:
    'Escolha uma data e hora futuras: o lembrete não pode ser marcado para um horário que já passou.',
  lembreteInexistente: 'Esta atividade não tem lembrete.',
  lembreteVencido:
    'O horário deste lembrete já passou. Escolha uma nova data e hora para reativá-lo.',
  lembreteJaDisparado:
    'Este lembrete já foi disparado. Para ser avisado de novo, escolha uma nova data e hora.',
  lembreteSalvo:
    'Lembrete salvo. O aviso aparece no horário escolhido enquanto o board estiver aberto neste navegador.',
  lembreteAtivado: 'Lembrete reativado.',
  lembreteDesativado: 'Lembrete desativado. Ele não dispara até ser reativado.',
  lembreteExcluido: 'Lembrete excluído.',
  tituloObrigatorio: 'Informe o título do lembrete.',
  tituloLongo: `O título pode ter no máximo ${LIMITES_TEXTO.TITULO_LEMBRETE} caracteres.`,
  observacaoLonga: `A observação pode ter no máximo ${LIMITES_TEXTO.OBSERVACAO_LEMBRETE} caracteres.`,
  lembreteAvulsoInexistente:
    'Este lembrete não existe mais. Recarregue a página para ver a lista atual.',
  lembreteAvulsoAlterado:
    'Este lembrete foi alterado em outra janela. Recarregue a página e tente novamente.',
  lembreteAvulsoCriado:
    'Lembrete criado. O aviso aparece no horário escolhido enquanto o board estiver aberto neste navegador.',
  lembreteAvulsoSalvo: 'Lembrete atualizado.',
  dadosInvalidos:
    'Os dados enviados são inválidos. Recarregue a página e tente novamente.',
  corrijaCampos: 'Corrija os campos destacados.',
} as const;
