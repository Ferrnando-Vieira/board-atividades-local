import { z } from 'zod';
import { LIMITES_TEXTO } from '@/config/constantes';
import { mensagensLembretes as mensagens } from '@/servidor/lembretes/mensagensLembretes';
import {
  campoIdentificador,
  campoTextoOpcional,
  identificadorJson,
} from '@/util/EsquemaUtils';
import { normalizarNomeExibicao } from '@/util/NormalizacaoUtils';

const identificadorFormulario = campoIdentificador(mensagens.dadosInvalidos);

// Data e hora chegam no fuso do board, como no prazo; o serviço converte
// para o instante em UTC e recusa horário que já passou.
export const esquemaDefinicaoLembrete = z.object({
  atividadeId: identificadorFormulario,
  versaoEsperada: identificadorFormulario,
  lembreteData: z.iso.date({ error: mensagens.dataObrigatoria }),
  lembreteHora: z.iso.time({ precision: -1, error: mensagens.horaObrigatoria }),
});

export type DefinicaoLembrete = z.output<typeof esquemaDefinicaoLembrete>;

export const esquemaAlteracaoLembrete = z.object({
  atividadeId: identificadorFormulario,
  versaoEsperada: identificadorFormulario,
});

export type AlteracaoLembrete = z.output<typeof esquemaAlteracaoLembrete>;

// O instante identifica qual disparo está sendo dispensado: se o lembrete
// foi remarcado nesse meio tempo, a dispensa antiga não alcança o novo.
export const esquemaDispensaLembrete = z.strictObject({
  atividadeId: identificadorJson,
  lembreteEm: z.iso.datetime(),
});

export type DispensaLembrete = z.output<typeof esquemaDispensaLembrete>;

// Lembrete sem atividade: título, observação opcional e data e hora no fuso
// do board (convertidas para UTC no serviço, que recusa horário passado).
const esquemaTituloLembrete = z.preprocess(
  (valor) =>
    typeof valor === 'string' ? normalizarNomeExibicao(valor) : valor,
  z
    .string({ error: mensagens.tituloObrigatorio })
    .min(1, { error: mensagens.tituloObrigatorio })
    .max(LIMITES_TEXTO.TITULO_LEMBRETE, { error: mensagens.tituloLongo }),
);

const camposLembreteAvulso = {
  titulo: esquemaTituloLembrete,
  observacao: campoTextoOpcional(
    LIMITES_TEXTO.OBSERVACAO_LEMBRETE,
    mensagens.observacaoLonga,
  ),
  lembreteData: z.iso.date({ error: mensagens.dataObrigatoria }),
  lembreteHora: z.iso.time({ precision: -1, error: mensagens.horaObrigatoria }),
};

export const esquemaNovoLembreteAvulso = z.object(camposLembreteAvulso);

export type NovoLembreteAvulso = z.output<typeof esquemaNovoLembreteAvulso>;

export const esquemaEdicaoLembreteAvulso = z.object({
  lembreteId: identificadorFormulario,
  versaoEsperada: identificadorFormulario,
  ...camposLembreteAvulso,
});

export type EdicaoLembreteAvulso = z.output<typeof esquemaEdicaoLembreteAvulso>;

export const esquemaAlteracaoLembreteAvulso = z.object({
  lembreteId: identificadorFormulario,
  versaoEsperada: identificadorFormulario,
});

export type AlteracaoLembreteAvulso = z.output<
  typeof esquemaAlteracaoLembreteAvulso
>;

export const esquemaDispensaLembreteAvulso = z.strictObject({
  lembreteId: identificadorJson,
  lembreteEm: z.iso.datetime(),
});

export type DispensaLembreteAvulso = z.output<
  typeof esquemaDispensaLembreteAvulso
>;
