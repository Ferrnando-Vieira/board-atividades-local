// O corpo maior que o útil é recusado antes do JSON.parse: a descrição tem
// até 20 mil caracteres, que cabem com folga mesmo escapados.
export const LIMITES_CORPO_API = {
  BYTES_MAXIMOS: 256 * 1024,
} as const;

export const LIMITE_VALORES_FILTRO = 50;
