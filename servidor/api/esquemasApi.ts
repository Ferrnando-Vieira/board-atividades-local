import { z } from 'zod';
import {
  LIMITES_TEXTO,
  PERMISSOES_API,
  PRIORIDADE,
  SITUACOES_LEMBRETE,
} from '@/config/constantes';
import { METODOS_API } from '@/servidor/api/catalogoApi';
import { LIMITE_VALORES_FILTRO } from '@/servidor/api/limitesApi';
import { mensagensApi } from '@/servidor/api/mensagensApi';
import { SITUACOES_ARQUIVAMENTO } from '@/servidor/atividades/filtrosAtividades';

// Entrada: só os tipos JSON. Regras de conteúdo (tamanhos, datas, hora sem
// data, normalização) ficam nos mesmos esquemas do domínio usados pela
// interface, aplicados depois destes; assim API e tela não divergem.
const identificador = z.int().positive();
const textoOuNulo = z.string().nullable();

// A descrição aparece formatada na tela; este texto chega aos agentes pelo
// esquema das ferramentas do MCP.
const DESCRICAO_CAMPO_DESCRICAO = `Markdown (GFM): **negrito**, _itálico_, listas, - [ ] tarefas, \`código\`, blocos \`\`\`, tabelas e links. Uma linha simples quebra a linha. Até ${LIMITES_TEXTO.DESCRICAO_ATIVIDADE} caracteres. HTML aparece como texto. Imagem só aparece se for anexo da própria atividade (![nome](anexo:ID)), enviada pela tela.`;

const camposEditaveisAtividade = {
  titulo: z.string(),
  descricao: textoOuNulo.describe(DESCRICAO_CAMPO_DESCRICAO),
  prioridade: z.int(),
  statusId: identificador,
  solicitante: textoOuNulo,
  tags: z.array(z.string()),
  prazoData: textoOuNulo,
  prazoHora: textoOuNulo,
  concluidaEmData: textoOuNulo,
  concluidaEmHora: textoOuNulo,
};

const { titulo: esquemaTituloApi, ...camposOpcionaisAtividade } =
  camposEditaveisAtividade;

export const esquemaCriacaoAtividadeApi = z.strictObject({
  titulo: esquemaTituloApi,
  ...z.object(camposOpcionaisAtividade).partial().shape,
});

export type CriacaoAtividadeApi = z.output<typeof esquemaCriacaoAtividadeApi>;

export const esquemaAtualizacaoAtividadeApi = z
  .strictObject({
    versaoEsperada: identificador,
    ...z.object(camposEditaveisAtividade).partial().shape,
  })
  .refine(
    (dados) => Object.keys(dados).some((campo) => campo !== 'versaoEsperada'),
    { error: mensagensApi.nenhumCampo },
  );

export type AtualizacaoAtividadeApi = z.output<
  typeof esquemaAtualizacaoAtividadeApi
>;

export const esquemaMovimentoAtividadeApi = z.strictObject({
  versaoEsperada: identificador,
  statusId: identificador.optional(),
  posicao: z.int().nonnegative().optional(),
});

export const esquemaVersaoApi = z.strictObject({
  versaoEsperada: identificador,
});

// Cor "#rrggbb" ou null (usar as cores globais da Aparência).
const corOuNula = z.string().nullable();

export const esquemaCriacaoStatusApi = z.strictObject({
  nome: z.string(),
  finalizaAtividade: z.boolean().optional(),
  corTitulo: corOuNula.optional(),
  corColuna: corOuNula.optional(),
});

export const esquemaAtualizacaoStatusApi = z
  .strictObject({
    versaoEsperada: identificador,
    nome: z.string().optional(),
    finalizaAtividade: z.boolean().optional(),
    corTitulo: corOuNula.optional(),
    corColuna: corOuNula.optional(),
  })
  .refine(
    (dados) =>
      dados.nome !== undefined ||
      dados.finalizaAtividade !== undefined ||
      dados.corTitulo !== undefined ||
      dados.corColuna !== undefined,
    { error: mensagensApi.nenhumCampo },
  );

export const esquemaMovimentoStatusApi = z.strictObject({
  posicao: z.int().nonnegative(),
});

export const esquemaNomeApi = z.strictObject({ nome: z.string() });

// Lembretes avulsos: data e hora chegam no fuso do board, com os mesmos
// nomes do domínio (lembreteData/lembreteHora), para que os erros de campo
// apontem para o que o agente enviou.
export const esquemaCriacaoLembreteApi = z.strictObject({
  titulo: z.string(),
  observacao: textoOuNulo.optional(),
  lembreteData: z.string(),
  lembreteHora: z.string(),
});

export const esquemaAtualizacaoLembreteApi = z
  .strictObject({
    versaoEsperada: identificador,
    titulo: z.string().optional(),
    observacao: textoOuNulo.optional(),
    lembreteData: z.string().optional(),
    lembreteHora: z.string().optional(),
  })
  .refine(
    (dados) =>
      dados.titulo !== undefined ||
      dados.observacao !== undefined ||
      dados.lembreteData !== undefined ||
      dados.lembreteHora !== undefined,
    { error: mensagensApi.nenhumCampo },
  );

const DESCRICAO_SOLICITANTE_PADRAO_TAG =
  'Solicitante gravado nas atividades com esta tag salvas sem solicitante (vale a tag vinculada primeiro). Nome novo é cadastrado; null ou vazio remove.';

export const esquemaCriacaoTagApi = z.strictObject({
  nome: z.string(),
  cor: corOuNula.optional(),
  solicitantePadrao: textoOuNulo
    .optional()
    .describe(DESCRICAO_SOLICITANTE_PADRAO_TAG),
});

export const esquemaEdicaoTagApi = z
  .strictObject({
    nomeAtual: z.string(),
    nome: z.string().optional(),
    cor: corOuNula.optional(),
    solicitantePadrao: textoOuNulo
      .optional()
      .describe(DESCRICAO_SOLICITANTE_PADRAO_TAG),
  })
  .refine(
    (dados) =>
      dados.nome !== undefined ||
      dados.cor !== undefined ||
      dados.solicitantePadrao !== undefined,
    { error: mensagensApi.nenhumCampo },
  );

// Parâmetros de consulta chegam como texto: inteiros só em forma decimal
// simples, sem sinal, espaço nem expoente.
const identificadorTexto = z
  .string()
  .regex(/^[1-9]\d{0,15}$/)
  .transform(Number)
  .pipe(z.int().positive());

export const esquemaConsultaAtividadesApi = z.strictObject({
  status: z.array(identificadorTexto).max(LIMITE_VALORES_FILTRO),
  tag: z
    .array(z.string().trim().min(1).max(LIMITES_TEXTO.NOME_TAG))
    .max(LIMITE_VALORES_FILTRO),
  solicitante: z
    .array(z.string().trim().min(1).max(LIMITES_TEXTO.NOME_SOLICITANTE))
    .max(LIMITE_VALORES_FILTRO),
  busca: z.string().trim().max(LIMITES_TEXTO.TERMO_BUSCA).optional(),
  situacao: z.enum(SITUACOES_ARQUIVAMENTO).default('ativas'),
});

export const esquemaExclusaoStatusApi = z.strictObject({
  versaoEsperada: identificadorTexto,
  statusDestinoId: identificadorTexto.optional(),
});

export const esquemaExclusaoTagApi = z.strictObject({
  nomeAtual: z.string().min(1),
});

export const esquemaConsultaLembretesApi = z.strictObject({
  situacao: z.enum(SITUACOES_LEMBRETE).optional(),
});

export const esquemaExclusaoLembreteApi = z.strictObject({
  versaoEsperada: identificadorTexto,
});

// Saída.
const esquemaItemNomeado = z.object({
  id: identificador,
  nome: z.string(),
});

export const esquemaAtividadeApi = z.object({
  id: identificador,
  titulo: z.string(),
  descricao: z.string().nullable(),
  prioridade: z.int().min(PRIORIDADE.MAIS_ALTA).max(PRIORIDADE.MAIS_BAIXA),
  versao: identificador,
  status: z.object({
    id: identificador,
    nome: z.string(),
    finalizaAtividade: z.boolean(),
  }),
  posicao: z.int().nonnegative().nullable(),
  solicitante: z.string(),
  tags: z.array(esquemaItemNomeado.extend({ cor: z.string().nullable() })),
  prazoData: z.iso.date().nullable(),
  prazoHora: z.string().nullable(),
  concluidaEmData: z.iso.date().nullable(),
  concluidaEmHora: z.string().nullable(),
  lembreteEm: z.string().nullable(),
  lembreteSituacao: z.enum(SITUACOES_LEMBRETE).nullable(),
  arquivada: z.boolean(),
  arquivadaEm: z.string().nullable(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});

export type AtividadeApi = z.output<typeof esquemaAtividadeApi>;

export const esquemaListaAtividadesApi = z.array(esquemaAtividadeApi);

export const esquemaStatusApi = z.object({
  id: identificador,
  nome: z.string(),
  posicao: z.int().nonnegative(),
  finalizaAtividade: z.boolean(),
  corTitulo: z.string().nullable(),
  corColuna: z.string().nullable(),
  versao: identificador,
  quantidadeAtivas: z.int().nonnegative(),
  quantidadeArquivadas: z.int().nonnegative(),
});

export const esquemaListaStatusApi = z.array(esquemaStatusApi);

export const esquemaBoardApi = z.object({
  nome: z.string(),
  fusoHorario: z.string(),
  status: esquemaListaStatusApi,
  totais: z.object({
    ativas: z.int().nonnegative(),
    arquivadas: z.int().nonnegative(),
  }),
});

const esquemaItemContado = esquemaItemNomeado.extend({
  quantidadeAtividades: z.int().nonnegative(),
});

export const esquemaTagApi = esquemaItemContado.extend({
  cor: z.string().nullable(),
  solicitantePadrao: z.string().nullable(),
});

export const esquemaListaTagsApi = z.array(esquemaTagApi);

export const esquemaListaSolicitantesApi = z.array(
  esquemaItemContado.extend({ padrao: z.boolean() }),
);

export const esquemaSolicitanteRegistradoApi = esquemaItemNomeado.extend({
  criado: z.boolean(),
});

export const esquemaExclusaoStatusResultadoApi = z.object({
  statusId: identificador,
  atividadesMovidas: z.int().nonnegative(),
});

export const esquemaLembreteApi = z.object({
  id: identificador,
  titulo: z.string(),
  observacao: z.string().nullable(),
  lembreteEm: z.string(),
  lembreteData: z.iso.date(),
  lembreteHora: z.string(),
  situacao: z.enum(SITUACOES_LEMBRETE),
  disparadoEm: z.string().nullable(),
  dispensadoEm: z.string().nullable(),
  versao: identificador,
});

export const esquemaListaLembretesApi = z.array(esquemaLembreteApi);

export const esquemaExclusaoLembreteResultadoApi = z.object({
  lembreteId: identificador,
});

export const esquemaExclusaoTagResultadoApi = z.object({
  tagId: identificador,
  atividadesAfetadas: z.int().nonnegative(),
});

export const esquemaIndiceApi = z.object({
  versao: z.literal('v1'),
  token: z.object({
    nome: z.string(),
    prefixo: z.string(),
    permissoes: z.array(z.enum(PERMISSOES_API)),
  }),
  endpoints: z.array(
    z.object({
      metodo: z.enum(METODOS_API),
      caminho: z.string(),
      permissoes: z.array(z.enum(PERMISSOES_API)),
      descricao: z.string(),
    }),
  ),
});
