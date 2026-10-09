import { z } from 'zod';
import { ehChaveAnimal } from '@/config/animais';
import { CAMPOS_COMPARTILHAMENTO } from '@/config/camposFormulario';
import {
  LIMITES_TEXTO,
  MODALIDADES_COMPARTILHAMENTO,
  VALOR_CAMPO_MARCADO,
} from '@/config/constantes';
import {
  COMPARTILHAMENTO,
  OPCOES_VALIDADE_DIAS,
} from '@/config/constantesSeguranca';
import { mensagensCompartilhamento as mensagens } from '@/servidor/compartilhamento/mensagensCompartilhamento';
import {
  campoIdentificador,
  campoListaIdentificadores,
  campoMarcado,
  campoOpcaoInteiraOpcional,
} from '@/util/EsquemaUtils';
import { normalizarNomeExibicao } from '@/util/NormalizacaoUtils';

export const CAMPOS_TEXTO_NOVO_LINK = [
  CAMPOS_COMPARTILHAMENTO.NOME,
  CAMPOS_COMPARTILHAMENTO.MODALIDADE,
  CAMPOS_COMPARTILHAMENTO.INCLUIR_ARQUIVADAS,
  CAMPOS_COMPARTILHAMENTO.VALIDADE,
  CAMPOS_COMPARTILHAMENTO.ANIMAL,
] as const;

export const CAMPOS_TEXTO_EDICAO_LINK = [
  CAMPOS_COMPARTILHAMENTO.LINK_ID,
  CAMPOS_COMPARTILHAMENTO.NOME,
  CAMPOS_COMPARTILHAMENTO.MODALIDADE,
  CAMPOS_COMPARTILHAMENTO.INCLUIR_ARQUIVADAS,
  CAMPOS_COMPARTILHAMENTO.VALIDADE,
] as const;

export const VALOR_MANTER_VALIDADE = 'manter';

export const CAMPOS_LISTA_NOVO_LINK = [
  CAMPOS_COMPARTILHAMENTO.TAGS,
  CAMPOS_COMPARTILHAMENTO.SOLICITANTES,
] as const;

const esquemaNomeLink = z.preprocess(
  (valor) =>
    typeof valor === 'string' ? normalizarNomeExibicao(valor) : valor,
  z
    .string({ error: mensagens.nomeObrigatorio })
    .min(1, { error: mensagens.nomeObrigatorio })
    .max(LIMITES_TEXTO.NOME_LINK_COMPARTILHAMENTO, {
      error: mensagens.nomeLongo,
    }),
);

// Em branco = sorteado a cada visita; fora isso, só um animal do catálogo.
const campoAnimal = z.preprocess(
  (valor) =>
    valor === null || valor === undefined || valor === '' ? null : valor,
  z
    .string({ error: mensagens.animalInvalido })
    .refine(ehChaveAnimal, { error: mensagens.animalInvalido })
    .nullable(),
);

const listaEscopo = campoListaIdentificadores(
  COMPARTILHAMENTO.MAXIMO_ITENS_ESCOPO,
  mensagens.dadosInvalidos,
  mensagens.escopoGrande,
);

const campoValidade = campoOpcaoInteiraOpcional(
  OPCOES_VALIDADE_DIAS,
  mensagens.validadeInvalida,
);

const identificadorLink = campoIdentificador(mensagens.dadosInvalidos);

const camposConfiguracaoLink = {
  nome: esquemaNomeLink,
  modalidade: z.enum(MODALIDADES_COMPARTILHAMENTO, {
    error: mensagens.modalidadeInvalida,
  }),
  tagIds: listaEscopo,
  solicitanteIds: listaEscopo,
  incluirArquivadas: campoMarcado(VALOR_CAMPO_MARCADO),
};

type ConfiguracaoLink = {
  modalidade: (typeof MODALIDADES_COMPARTILHAMENTO)[number];
  tagIds: number[];
  solicitanteIds: number[];
  incluirArquivadas: boolean;
};

function exigirEscopoNoRestrito(
  dados: ConfiguracaoLink,
  contexto: z.RefinementCtx,
): void {
  if (
    dados.modalidade === 'restrito' &&
    dados.tagIds.length === 0 &&
    dados.solicitanteIds.length === 0
  ) {
    contexto.addIssue({
      code: 'custom',
      message: mensagens.escopoObrigatorio,
      path: [],
    });
  }
}

// No link completo o escopo não se aplica: tags e solicitantes marcados antes
// de trocar a modalidade são descartados, e as arquivadas sempre aparecem.
function descartarEscopoNoCompleto<T extends ConfiguracaoLink>(dados: T): T {
  return dados.modalidade === 'completo'
    ? { ...dados, tagIds: [], solicitanteIds: [], incluirArquivadas: true }
    : dados;
}

export const esquemaNovoLink = z
  .object({
    ...camposConfiguracaoLink,
    validadeDias: campoValidade,
    animal: campoAnimal,
  })
  .superRefine(exigirEscopoNoRestrito)
  .transform(descartarEscopoNoCompleto);

export type DadosNovoLink = z.output<typeof esquemaNovoLink>;

// "Manter" deixa a validade como está (undefined); vazio remove a expiração.
export const esquemaEdicaoLink = z
  .object({
    linkId: identificadorLink,
    ...camposConfiguracaoLink,
    validadeDias: z.union([
      z.literal(VALOR_MANTER_VALIDADE).transform(() => undefined),
      campoValidade,
    ]),
  })
  .superRefine(exigirEscopoNoRestrito)
  .transform(descartarEscopoNoCompleto);

export type DadosEdicaoLink = z.output<typeof esquemaEdicaoLink>;

export const esquemaReferenciaLink = z.object({
  linkId: identificadorLink,
});

export type DadosReferenciaLink = z.output<typeof esquemaReferenciaLink>;

export const CAMPOS_ANIMAL_LINK = [
  CAMPOS_COMPARTILHAMENTO.LINK_ID,
  CAMPOS_COMPARTILHAMENTO.ANIMAL,
] as const;

export const esquemaAnimalLink = z.object({
  linkId: identificadorLink,
  animal: campoAnimal,
});

export type DadosAnimalLink = z.output<typeof esquemaAnimalLink>;
