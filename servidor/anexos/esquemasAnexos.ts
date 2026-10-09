import { z } from 'zod';
import { mensagensAnexos as mensagens } from '@/servidor/anexos/mensagensAnexos';
import { campoIdentificador } from '@/util/EsquemaUtils';

const identificadorFormulario = campoIdentificador(mensagens.dadosInvalidos);

// O conteúdo do arquivo não passa por aqui: chega como File e é validado por
// validarArquivoAnexo (tamanho, nome, extensão e assinatura).
export const esquemaEnvioAnexo = z.object({
  atividadeId: identificadorFormulario,
});

export const esquemaRemocaoAnexo = z.object({
  atividadeId: identificadorFormulario,
  anexoId: identificadorFormulario,
});
