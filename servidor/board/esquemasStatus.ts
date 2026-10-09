import { z } from 'zod';
import {
  LIMITES_COLECAO,
  LIMITES_TEXTO,
  VALOR_CAMPO_MARCADO,
} from '@/config/constantes';
import { mensagensStatus as mensagens } from '@/servidor/board/mensagensStatus';
import {
  campoCorOpcional,
  campoIdentificador,
  campoIdentificadorOpcional,
  campoMarcado,
  identificadorJson,
} from '@/util/EsquemaUtils';
import { possuiRepetidos } from '@/util/ListaUtils';
import { normalizarNomeExibicao } from '@/util/NormalizacaoUtils';

const esquemaNomeStatus = z.preprocess(
  (valor) =>
    typeof valor === 'string' ? normalizarNomeExibicao(valor) : valor,
  z
    .string({ error: mensagens.nomeObrigatorio })
    .min(1, { error: mensagens.nomeObrigatorio })
    .max(LIMITES_TEXTO.NOME_STATUS, { error: mensagens.nomeLongo }),
);

const identificadorFormulario = campoIdentificador(mensagens.dadosInvalidos);

const campoFinaliza = campoMarcado(VALOR_CAMPO_MARCADO);

// Cores próprias da coluna; nulas = cores globais definidas em Aparência.
// Ausentes (chamadas internas que não tratam de cor) mantêm as atuais.
const campoCor = campoCorOpcional(mensagens.corInvalida).optional();

export const esquemaNovoStatus = z.object({
  nome: esquemaNomeStatus,
  finalizaAtividade: campoFinaliza,
  corTitulo: campoCor,
  corColuna: campoCor,
});

export type DadosNovoStatus = z.output<typeof esquemaNovoStatus>;

export const esquemaEdicaoStatus = z.object({
  statusId: identificadorFormulario,
  versaoEsperada: identificadorFormulario,
  nome: esquemaNomeStatus,
  finalizaAtividade: campoFinaliza,
  corTitulo: campoCor,
  corColuna: campoCor,
});

export type DadosEdicaoStatus = z.output<typeof esquemaEdicaoStatus>;

export const esquemaExclusaoStatus = z.object({
  statusId: identificadorFormulario,
  versaoEsperada: identificadorFormulario,
  statusDestinoId: campoIdentificadorOpcional(mensagens.destinoObrigatorio),
});

export type DadosExclusaoStatus = z.output<typeof esquemaExclusaoStatus>;

// `ordemNova` traz todas as colunas já com o status na nova posição; o
// restante da lista precisa coincidir com a ordem gravada.
export const esquemaReordenacaoStatus = z
  .strictObject({
    statusId: identificadorJson,
    ordemNova: z
      .array(identificadorJson)
      .min(1)
      .max(LIMITES_COLECAO.ITENS_POR_ORDENACAO),
  })
  .refine(
    (reordenacao) =>
      !possuiRepetidos(reordenacao.ordemNova) &&
      reordenacao.ordemNova.includes(reordenacao.statusId),
    { error: mensagens.dadosInvalidos },
  );

export type ReordenacaoStatus = z.output<typeof esquemaReordenacaoStatus>;

export const esquemaMovimentoStatusPorPosicao = z.strictObject({
  statusId: identificadorJson,
  posicao: z
    .int({ error: mensagens.posicaoInvalida })
    .nonnegative({ error: mensagens.posicaoInvalida })
    .max(LIMITES_COLECAO.ITENS_POR_ORDENACAO, {
      error: mensagens.posicaoInvalida,
    }),
});

export type MovimentoStatusPorPosicao = z.output<
  typeof esquemaMovimentoStatusPorPosicao
>;
