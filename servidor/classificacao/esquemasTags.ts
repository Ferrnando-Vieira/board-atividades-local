import { z } from 'zod';
import { LIMITES_TEXTO } from '@/config/constantes';
import { mensagensTags as mensagens } from '@/servidor/classificacao/mensagensTags';
import { campoCorOpcional, campoIdentificador } from '@/util/EsquemaUtils';
import { normalizarNomeExibicao } from '@/util/NormalizacaoUtils';

export const esquemaNomeTag = z.preprocess(
  (valor) =>
    typeof valor === 'string' ? normalizarNomeExibicao(valor) : valor,
  z
    .string({ error: mensagens.nomeObrigatorio })
    .min(1, { error: mensagens.nomeObrigatorio })
    .max(LIMITES_TEXTO.NOME_TAG, { error: mensagens.nomeLongo }),
);

const identificadorFormulario = campoIdentificador(mensagens.dadosInvalidos);

// `nomeAtual` é o nome que a tela exibia: tags não têm coluna de versão, e o
// próprio nome serve de condição para não sobrescrever uma alteração alheia.
const esquemaNomeAtual = z.string({ error: mensagens.dadosInvalidos }).min(1, {
  error: mensagens.dadosInvalidos,
});

// Nula = chip neutro. Ausente (API sem o campo) mantém a cor atual.
const campoCor = campoCorOpcional(mensagens.corInvalida).optional();

// Em branco ou nulo = a tag não define solicitante. Ausente (API sem o
// campo) mantém o atual. Um nome sem cadastro é cadastrado ao salvar.
const campoSolicitantePadrao = z
  .preprocess(
    (valor) =>
      typeof valor === 'string' ? normalizarNomeExibicao(valor) || null : valor,
    z
      .string({ error: mensagens.dadosInvalidos })
      .max(LIMITES_TEXTO.NOME_SOLICITANTE, {
        error: mensagens.solicitanteLongo,
      })
      .nullable(),
  )
  .optional();

export const esquemaNovaTag = z.object({
  nome: esquemaNomeTag,
  cor: campoCor,
  solicitantePadrao: campoSolicitantePadrao,
});

export type DadosNovaTag = z.output<typeof esquemaNovaTag>;

export const esquemaEdicaoTag = z.object({
  tagId: identificadorFormulario,
  nomeAtual: esquemaNomeAtual,
  nome: esquemaNomeTag,
  cor: campoCor,
  solicitantePadrao: campoSolicitantePadrao,
});

export type DadosEdicaoTag = z.output<typeof esquemaEdicaoTag>;

export const esquemaExclusaoTag = z.object({
  tagId: identificadorFormulario,
  nomeAtual: esquemaNomeAtual,
});

export type DadosExclusaoTag = z.output<typeof esquemaExclusaoTag>;
