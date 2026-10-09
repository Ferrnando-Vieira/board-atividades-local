import { z } from 'zod';
import { CAMPOS_ATIVIDADE } from '@/config/camposFormulario';
import {
  LIMITES_COLECAO,
  LIMITES_TEXTO,
  PRIORIDADE,
} from '@/config/constantes';
import { mensagensAtividades as mensagens } from '@/servidor/atividades/mensagensAtividades';
import { esquemaNomeTag } from '@/servidor/classificacao/esquemasTags';
import {
  campoDataOpcional,
  campoHoraOpcional,
  campoIdentificador,
  campoInteiroComPadrao,
  campoTextoOpcional,
  identificadorJson,
} from '@/util/EsquemaUtils';
import { possuiRepetidos } from '@/util/ListaUtils';
import {
  normalizarNomeExibicao,
  removerNomesRepetidos,
} from '@/util/NormalizacaoUtils';

export const CAMPOS_TEXTO_ATIVIDADE = [
  CAMPOS_ATIVIDADE.ATIVIDADE_ID,
  CAMPOS_ATIVIDADE.VERSAO,
  CAMPOS_ATIVIDADE.TITULO,
  CAMPOS_ATIVIDADE.DESCRICAO,
  CAMPOS_ATIVIDADE.PRIORIDADE,
  CAMPOS_ATIVIDADE.STATUS,
  CAMPOS_ATIVIDADE.SOLICITANTE,
  CAMPOS_ATIVIDADE.PRAZO_DATA,
  CAMPOS_ATIVIDADE.PRAZO_HORA,
  CAMPOS_ATIVIDADE.CONCLUSAO_DATA,
  CAMPOS_ATIVIDADE.CONCLUSAO_HORA,
] as const;

export const CAMPOS_LISTA_ATIVIDADE = [CAMPOS_ATIVIDADE.TAGS] as const;

function ehListaDeTextos(valor: unknown): valor is string[] {
  return (
    Array.isArray(valor) && valor.every((item) => typeof item === 'string')
  );
}

// Em branco vira nulo, e o serviço grava o solicitante padrão do board; a
// grafia gravada é decidida pelo cadastro normalizado (garantirSolicitante).
function prepararSolicitante(valor: unknown): unknown {
  if (valor === null || valor === undefined) {
    return null;
  }
  if (typeof valor !== 'string') {
    return valor;
  }
  const nome = normalizarNomeExibicao(valor);
  return nome === '' ? null : nome;
}

const esquemaTitulo = z
  .string({ error: mensagens.tituloObrigatorio })
  .trim()
  .min(1, { error: mensagens.tituloObrigatorio })
  .max(LIMITES_TEXTO.TITULO_ATIVIDADE, { error: mensagens.tituloLongo });

const esquemaSolicitante = z.preprocess(
  prepararSolicitante,
  z
    .string({ error: mensagens.dadosInvalidos })
    .max(LIMITES_TEXTO.NOME_SOLICITANTE, {
      error: mensagens.solicitanteLongo,
    })
    .nullable(),
);

const esquemaTags = z.preprocess(
  (valor) => (ehListaDeTextos(valor) ? removerNomesRepetidos(valor) : valor),
  z
    .array(
      z.string().max(LIMITES_TEXTO.NOME_TAG, { error: mensagens.tagLonga }),
      { error: mensagens.dadosInvalidos },
    )
    .max(LIMITES_COLECAO.TAGS_POR_ATIVIDADE, { error: mensagens.tagsDemais }),
);

const identificadorFormulario = campoIdentificador(mensagens.dadosInvalidos);

const formaDadosAtividade = {
  titulo: esquemaTitulo,
  descricao: campoTextoOpcional(
    LIMITES_TEXTO.DESCRICAO_ATIVIDADE,
    mensagens.descricaoLonga,
  ),
  prioridade: campoInteiroComPadrao(
    PRIORIDADE.MAIS_ALTA,
    PRIORIDADE.MAIS_BAIXA,
    PRIORIDADE.PADRAO,
    mensagens.prioridadeInvalida,
  ),
  statusId: campoIdentificador(mensagens.statusObrigatorio),
  solicitante: esquemaSolicitante,
  tags: esquemaTags,
  prazoData: campoDataOpcional(mensagens.dataInvalida),
  prazoHora: campoHoraOpcional(mensagens.horaInvalida),
  concluidaEmData: campoDataOpcional(mensagens.dataInvalida),
  concluidaEmHora: campoHoraOpcional(mensagens.horaInvalida),
};

type HorariosAtividade = {
  prazoData: string | null;
  prazoHora: string | null;
  concluidaEmData: string | null;
  concluidaEmHora: string | null;
};

// O banco também recusa hora sem data (CHECK), mas aqui o erro aparece no
// campo certo em vez de virar falha genérica de gravação.
function exigirDataParaHora(
  dados: HorariosAtividade,
  contexto: z.RefinementCtx,
): void {
  if (dados.prazoHora && !dados.prazoData) {
    contexto.addIssue({
      code: 'custom',
      message: mensagens.horaSemData,
      path: [CAMPOS_ATIVIDADE.PRAZO_DATA],
    });
  }
  if (dados.concluidaEmHora && !dados.concluidaEmData) {
    contexto.addIssue({
      code: 'custom',
      message: mensagens.horaSemData,
      path: [CAMPOS_ATIVIDADE.CONCLUSAO_DATA],
    });
  }
}

export const esquemaNovaAtividade = z
  .object(formaDadosAtividade)
  .superRefine(exigirDataParaHora);

export const esquemaEdicaoAtividade = z
  .object({
    ...formaDadosAtividade,
    atividadeId: identificadorFormulario,
    versaoEsperada: identificadorFormulario,
  })
  .superRefine(exigirDataParaHora);

export type DadosAtividade = z.output<typeof esquemaNovaAtividade>;

export type DadosEdicaoAtividade = z.output<typeof esquemaEdicaoAtividade>;

export const esquemaArquivamentoAtividade = z.object({
  atividadeId: identificadorFormulario,
  versaoEsperada: identificadorFormulario,
});

export type AlteracaoArquivamento = z.output<
  typeof esquemaArquivamentoAtividade
>;

// `ordemDestino` é a coluna de destino inteira, já com a atividade na nova
// posição: o servidor tira dela a atividade e confere o restante com o banco.
export const esquemaMovimentoAtividade = z
  .strictObject({
    atividadeId: identificadorJson,
    versaoEsperada: identificadorJson,
    statusDestinoId: identificadorJson,
    ordemDestino: z
      .array(identificadorJson)
      .min(1)
      .max(LIMITES_COLECAO.ITENS_POR_ORDENACAO),
  })
  .refine(
    (movimento) =>
      !possuiRepetidos(movimento.ordemDestino) &&
      movimento.ordemDestino.includes(movimento.atividadeId),
    { error: mensagens.dadosInvalidos },
  );

export type MovimentoAtividade = z.output<typeof esquemaMovimentoAtividade>;

// Variante sem a coluna inteira, para clientes como a API: a posição é o
// índice na coluna de destino sem a própria atividade; nula vai para o fim.
export const esquemaMovimentoPorPosicao = z.strictObject({
  atividadeId: identificadorJson,
  versaoEsperada: identificadorJson,
  statusDestinoId: identificadorJson,
  posicao: z
    .int({ error: mensagens.posicaoInvalida })
    .nonnegative({ error: mensagens.posicaoInvalida })
    .max(LIMITES_COLECAO.ITENS_POR_ORDENACAO, {
      error: mensagens.posicaoInvalida,
    })
    .nullable(),
});

export type MovimentoPorPosicao = z.output<typeof esquemaMovimentoPorPosicao>;

// Vínculo rápido pelo cartão: o nome passa pela mesma normalização do
// cadastro de tags, e o servidor reaproveita a tag equivalente se existir.
export const esquemaVinculoTag = z.strictObject({
  atividadeId: identificadorJson,
  nome: esquemaNomeTag,
});

export type VinculoTag = z.output<typeof esquemaVinculoTag>;

export const esquemaDesvinculoTag = z.strictObject({
  atividadeId: identificadorJson,
  tagId: identificadorJson,
});

export type DesvinculoTag = z.output<typeof esquemaDesvinculoTag>;
