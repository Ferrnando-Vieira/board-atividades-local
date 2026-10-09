import { LIMITES_TEXTO } from '@/config/constantes';

export const mensagensSolicitantes = {
  nomeObrigatorio: 'Informe o nome do solicitante.',
  nomeLongo: `O nome do solicitante pode ter no máximo ${LIMITES_TEXTO.NOME_SOLICITANTE} caracteres.`,
  padraoSalvo: 'Solicitante padrão salvo.',
  corrijaCampo: 'Corrija o campo destacado.',
  padraoAusente:
    'Informe o solicitante: este board ainda não tem solicitante padrão. Defina um em Solicitantes.',
} as const;
