import { z } from 'zod';
import { LIMITES_TEXTO } from '@/config/constantes';
import { mensagensSolicitantes as mensagens } from '@/servidor/classificacao/mensagensSolicitantes';
import { normalizarNomeExibicao } from '@/util/NormalizacaoUtils';

// Diferente do campo do formulário de atividade, aqui o nome em branco é
// erro: cadastrar explicitamente não pode cair no solicitante padrão sem querer.
export const esquemaNomeSolicitante = z.preprocess(
  (valor) =>
    typeof valor === 'string' ? normalizarNomeExibicao(valor) : valor,
  z
    .string({ error: mensagens.nomeObrigatorio })
    .min(1, { error: mensagens.nomeObrigatorio })
    .max(LIMITES_TEXTO.NOME_SOLICITANTE, { error: mensagens.nomeLongo }),
);

export const esquemaNovoSolicitante = z.object({
  nome: esquemaNomeSolicitante,
});

export type DadosNovoSolicitante = z.output<typeof esquemaNovoSolicitante>;
