import { LIMITES_ANEXO } from '@/config/anexos';

// O corpo maior que o útil é recusado antes do JSON.parse: a descrição tem
// até 20 mil caracteres, que cabem com folga mesmo escapados. O envio de
// anexos tem o mesmo teto das Server Actions (arquivos mais a margem do
// multipart).
export const LIMITES_CORPO_API = {
  BYTES_MAXIMOS: 256 * 1024,
  BYTES_MAXIMOS_ARQUIVOS:
    LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES +
    LIMITES_ANEXO.MARGEM_CORPO_ENVIO_BYTES,
} as const;

export const LIMITE_VALORES_FILTRO = 50;
