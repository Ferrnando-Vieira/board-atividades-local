import path from 'node:path';
import { z } from 'zod';
import { LIMITES_ANEXO } from '@/config/anexos';
import { SITUACOES_LEMBRETE } from '@/config/constantes';
import { ENDPOINTS_API, type EndpointApi } from '@/servidor/api/catalogoApi';
import {
  esquemaAtualizacaoAtividadeApi,
  esquemaAtualizacaoLembreteApi,
  esquemaAtualizacaoStatusApi,
  esquemaCriacaoAtividadeApi,
  esquemaCriacaoLembreteApi,
  esquemaCriacaoStatusApi,
  esquemaCriacaoTagApi,
  esquemaDefinicaoLembreteAtividadeApi,
  esquemaEdicaoTagApi,
  esquemaMovimentoAtividadeApi,
  esquemaMovimentoStatusApi,
  esquemaNomeApi,
} from '@/servidor/api/esquemasApi';
import { LIMITE_VALORES_FILTRO } from '@/servidor/api/limitesApi';
import { SITUACOES_ARQUIVAMENTO } from '@/servidor/atividades/filtrosAtividades';
import {
  chamarApi,
  type ConfiguracaoCliente,
  type RequisicaoApi,
} from '@/servidor/mcp/clienteApiBoard';
import type {
  FerramentaMcp,
  ResultadoFerramenta,
} from '@/servidor/mcp/protocoloMcp';
import { textosMcp } from '@/servidor/mcp/textosMcp';

type ChaveEndpoint = keyof typeof ENDPOINTS_API;

type PartesRequisicao = Pick<
  RequisicaoApi,
  'consulta' | 'corpo' | 'arquivos'
> & {
  id?: number;
  anexoId?: number;
};

type DefinicaoFerramenta = {
  nome: string;
  titulo: string;
  dica?: string;
  entrada: z.ZodObject;
  montar: (argumentos: Record<string, unknown>) => PartesRequisicao;
};

const MARCADOR_ID = '{id}';
const MARCADOR_ANEXO_ID = '{anexoId}';

const identificador = (descricao: string) =>
  z.int().positive().describe(descricao);

const versaoEsperada = identificador(
  'Versão atual do item (campo "versao" lido antes); evita sobrescrever alteração de outra pessoa.',
);

// Os esquemas de entrada da API vêm de esquemasApi (os mesmos que a rota
// confere); aqui só se acrescenta o identificador do caminho.
function definir<Entrada extends z.ZodObject>(definicao: {
  nome: string;
  titulo: string;
  dica?: string;
  entrada: Entrada;
  montar?: (argumentos: z.output<Entrada>) => PartesRequisicao;
}): DefinicaoFerramenta {
  return {
    ...definicao,
    montar: (argumentos) =>
      definicao.montar ? definicao.montar(argumentos as z.output<Entrada>) : {},
  };
}

function separarId<T extends { id: number }>(
  argumentos: T,
): { id: number; corpo: Omit<T, 'id'> } {
  const { id, ...corpo } = argumentos;
  return { id, corpo };
}

const SEM_ARGUMENTOS = z.strictObject({});

const ID_ATIVIDADE = z.strictObject({ id: identificador('Id da atividade') });

const VERSAO_ATIVIDADE = z.strictObject({
  id: identificador('Id da atividade'),
  versaoEsperada,
});

const REFERENCIA_ANEXO = z.strictObject({
  id: identificador('Id da atividade'),
  anexoId: identificador('Id do anexo (campo "id" de listar_anexos)'),
});

// Record com todas as chaves do catálogo: endpoint novo na API sem
// ferramenta correspondente não compila.
const DEFINICOES: Record<ChaveEndpoint, DefinicaoFerramenta> = {
  indice: definir({
    nome: 'identificar_token',
    titulo: 'Identificar o token',
    dica: 'Use primeiro: mostra as permissões do token configurado.',
    entrada: SEM_ARGUMENTOS,
  }),
  lerBoard: definir({
    nome: 'ler_board',
    titulo: 'Ler o board',
    entrada: SEM_ARGUMENTOS,
  }),
  listarAtividades: definir({
    nome: 'listar_atividades',
    titulo: 'Listar atividades',
    entrada: z.strictObject({
      status: z
        .array(identificador('Id de status'))
        .max(LIMITE_VALORES_FILTRO)
        .optional()
        .describe('Ids de status (qualquer um deles).'),
      tag: z
        .array(z.string())
        .max(LIMITE_VALORES_FILTRO)
        .optional()
        .describe('Nomes de tags (qualquer uma delas).'),
      solicitante: z
        .array(z.string())
        .max(LIMITE_VALORES_FILTRO)
        .optional()
        .describe('Nomes de solicitantes (qualquer um deles).'),
      busca: z
        .string()
        .optional()
        .describe(
          'Palavras procuradas no título, descrição, solicitante e tags; todas precisam aparecer.',
        ),
      situacao: z
        .enum(SITUACOES_ARQUIVAMENTO)
        .optional()
        .describe('Padrão: ativas.'),
    }),
    montar: (argumentos) => ({ consulta: argumentos }),
  }),
  criarAtividade: definir({
    nome: 'criar_atividade',
    titulo: 'Criar atividade',
    entrada: esquemaCriacaoAtividadeApi,
    montar: (argumentos) => ({ corpo: argumentos }),
  }),
  lerAtividade: definir({
    nome: 'ler_atividade',
    titulo: 'Ler atividade',
    entrada: z.strictObject({ id: identificador('Id da atividade') }),
    montar: ({ id }) => ({ id }),
  }),
  atualizarAtividade: definir({
    nome: 'atualizar_atividade',
    titulo: 'Atualizar atividade',
    entrada: z.strictObject({
      id: identificador('Id da atividade'),
      ...esquemaAtualizacaoAtividadeApi.shape,
      versaoEsperada,
    }),
    montar: (argumentos) => separarId(argumentos),
  }),
  moverAtividade: definir({
    nome: 'mover_atividade',
    titulo: 'Mover atividade',
    entrada: z.strictObject({
      id: identificador('Id da atividade'),
      ...esquemaMovimentoAtividadeApi.omit({ posicao: true }).shape,
      versaoEsperada,
    }),
    montar: (argumentos) => separarId(argumentos),
  }),
  arquivarAtividade: definir({
    nome: 'arquivar_atividade',
    titulo: 'Arquivar atividade',
    entrada: VERSAO_ATIVIDADE,
    montar: (argumentos) => separarId(argumentos),
  }),
  desarquivarAtividade: definir({
    nome: 'desarquivar_atividade',
    titulo: 'Desarquivar atividade',
    entrada: VERSAO_ATIVIDADE,
    montar: (argumentos) => separarId(argumentos),
  }),
  lerHistoricoAtividade: definir({
    nome: 'ler_historico_atividade',
    titulo: 'Ler o histórico de alterações da atividade',
    entrada: ID_ATIVIDADE,
    montar: ({ id }) => ({ id }),
  }),
  listarAnexos: definir({
    nome: 'listar_anexos',
    titulo: 'Listar anexos da atividade',
    entrada: ID_ATIVIDADE,
    montar: ({ id }) => ({ id }),
  }),
  enviarAnexos: definir({
    nome: 'anexar_arquivos',
    titulo: 'Anexar arquivos à atividade',
    dica: 'Para exibir uma imagem na descrição, coloque o "markdown" devolvido no campo descricao com atualizar_atividade, usando a versão já lida.',
    entrada: z.strictObject({
      id: identificador('Id da atividade'),
      arquivos: z
        .array(
          z.string().refine(path.isAbsolute, {
            error: textosMcp.caminhoRelativo,
          }),
        )
        .min(1)
        .max(LIMITES_ANEXO.MAXIMO_POR_ENVIO)
        .describe('Caminhos absolutos de arquivos nesta máquina.'),
    }),
    montar: ({ id, arquivos }) => ({ id, arquivos }),
  }),
  lerAnexo: definir({
    nome: 'ler_anexo',
    titulo: 'Ler anexo da atividade',
    dica: 'Imagens PNG, JPG, GIF e WebP voltam como imagem; TXT, CSV e MD, como texto; os demais tipos, só com tipo e tamanho.',
    entrada: REFERENCIA_ANEXO,
    montar: ({ id, anexoId }) => ({ id, anexoId }),
  }),
  removerAnexo: definir({
    nome: 'remover_anexo',
    titulo: 'Remover anexo da atividade',
    entrada: REFERENCIA_ANEXO,
    montar: ({ id, anexoId }) => ({ id, anexoId }),
  }),
  definirLembreteAtividade: definir({
    nome: 'definir_lembrete_atividade',
    titulo: 'Definir ou remarcar o lembrete da atividade',
    dica: 'O aviso aparece no navegador do proprietário, com o board aberto, no horário marcado.',
    entrada: z.strictObject({
      id: identificador('Id da atividade'),
      ...esquemaDefinicaoLembreteAtividadeApi.shape,
      versaoEsperada,
    }),
    montar: (argumentos) => separarId(argumentos),
  }),
  desativarLembreteAtividade: definir({
    nome: 'desativar_lembrete_atividade',
    titulo: 'Desativar o lembrete da atividade',
    entrada: VERSAO_ATIVIDADE,
    montar: (argumentos) => separarId(argumentos),
  }),
  reativarLembreteAtividade: definir({
    nome: 'reativar_lembrete_atividade',
    titulo: 'Reativar o lembrete da atividade',
    entrada: VERSAO_ATIVIDADE,
    montar: (argumentos) => separarId(argumentos),
  }),
  excluirLembreteAtividade: definir({
    nome: 'excluir_lembrete_atividade',
    titulo: 'Excluir o lembrete da atividade',
    entrada: VERSAO_ATIVIDADE,
    montar: ({ id, ...consulta }) => ({ id, consulta }),
  }),
  listarLembretes: definir({
    nome: 'listar_lembretes',
    titulo: 'Listar lembretes avulsos',
    entrada: z.strictObject({
      situacao: z
        .enum(SITUACOES_LEMBRETE)
        .optional()
        .describe('Só os lembretes nesta situação; sem ela, todos.'),
    }),
    montar: (argumentos) => ({ consulta: argumentos }),
  }),
  criarLembrete: definir({
    nome: 'criar_lembrete',
    titulo: 'Criar lembrete avulso',
    dica: 'O aviso aparece no navegador do proprietário, com o board aberto, no horário marcado.',
    entrada: esquemaCriacaoLembreteApi,
    montar: (argumentos) => ({ corpo: argumentos }),
  }),
  lerLembrete: definir({
    nome: 'ler_lembrete',
    titulo: 'Ler lembrete avulso',
    entrada: z.strictObject({ id: identificador('Id do lembrete') }),
    montar: ({ id }) => ({ id }),
  }),
  atualizarLembrete: definir({
    nome: 'atualizar_lembrete',
    titulo: 'Atualizar ou remarcar lembrete avulso',
    entrada: z.strictObject({
      id: identificador('Id do lembrete'),
      ...esquemaAtualizacaoLembreteApi.shape,
      versaoEsperada,
    }),
    montar: (argumentos) => separarId(argumentos),
  }),
  desativarLembrete: definir({
    nome: 'desativar_lembrete',
    titulo: 'Desativar lembrete avulso',
    entrada: z.strictObject({
      id: identificador('Id do lembrete'),
      versaoEsperada,
    }),
    montar: (argumentos) => separarId(argumentos),
  }),
  reativarLembrete: definir({
    nome: 'reativar_lembrete',
    titulo: 'Reativar lembrete avulso',
    entrada: z.strictObject({
      id: identificador('Id do lembrete'),
      versaoEsperada,
    }),
    montar: (argumentos) => separarId(argumentos),
  }),
  excluirLembrete: definir({
    nome: 'excluir_lembrete',
    titulo: 'Excluir lembrete avulso',
    entrada: z.strictObject({
      id: identificador('Id do lembrete'),
      versaoEsperada,
    }),
    montar: ({ id, ...consulta }) => ({ id, consulta }),
  }),
  listarStatus: definir({
    nome: 'listar_status',
    titulo: 'Listar status (colunas)',
    entrada: SEM_ARGUMENTOS,
  }),
  criarStatus: definir({
    nome: 'criar_status',
    titulo: 'Criar status (coluna)',
    entrada: esquemaCriacaoStatusApi,
    montar: (argumentos) => ({ corpo: argumentos }),
  }),
  atualizarStatus: definir({
    nome: 'atualizar_status',
    titulo: 'Atualizar status (coluna)',
    entrada: z.strictObject({
      id: identificador('Id do status'),
      ...esquemaAtualizacaoStatusApi.shape,
      versaoEsperada,
    }),
    montar: (argumentos) => separarId(argumentos),
  }),
  moverStatus: definir({
    nome: 'mover_status',
    titulo: 'Mover status (coluna)',
    entrada: z.strictObject({
      id: identificador('Id do status'),
      ...esquemaMovimentoStatusApi.shape,
    }),
    montar: (argumentos) => separarId(argumentos),
  }),
  excluirStatus: definir({
    nome: 'excluir_status',
    titulo: 'Excluir status (coluna)',
    dica: 'Nenhuma atividade é apagada: as do status vão para statusDestinoId.',
    entrada: z.strictObject({
      id: identificador('Id do status'),
      versaoEsperada,
      statusDestinoId: identificador(
        'Status que recebe as atividades (obrigatório se houver alguma).',
      ).optional(),
    }),
    montar: ({ id, ...consulta }) => ({ id, consulta }),
  }),
  listarTags: definir({
    nome: 'listar_tags',
    titulo: 'Listar tags',
    entrada: SEM_ARGUMENTOS,
  }),
  criarTag: definir({
    nome: 'criar_tag',
    titulo: 'Criar tag',
    entrada: esquemaCriacaoTagApi,
    montar: (argumentos) => ({ corpo: argumentos }),
  }),
  editarTag: definir({
    nome: 'editar_tag',
    titulo: 'Editar tag: nome, cor ou solicitante padrão',
    entrada: z.strictObject({
      id: identificador('Id da tag'),
      ...esquemaEdicaoTagApi.shape,
    }),
    montar: (argumentos) => separarId(argumentos),
  }),
  excluirTag: definir({
    nome: 'excluir_tag',
    titulo: 'Excluir tag',
    dica: 'As atividades continuam existindo, só sem a tag.',
    entrada: z.strictObject({
      id: identificador('Id da tag'),
      nomeAtual: z.string().describe('Nome atual da tag (confirmação).'),
    }),
    montar: ({ id, ...consulta }) => ({ id, consulta }),
  }),
  listarSolicitantes: definir({
    nome: 'listar_solicitantes',
    titulo: 'Listar solicitantes',
    entrada: SEM_ARGUMENTOS,
  }),
  registrarSolicitante: definir({
    nome: 'registrar_solicitante',
    titulo: 'Registrar solicitante',
    entrada: esquemaNomeApi,
    montar: (argumentos) => ({ corpo: argumentos }),
  }),
  definirSolicitantePadrao: definir({
    nome: 'definir_solicitante_padrao',
    titulo: 'Definir o solicitante padrão do board',
    entrada: esquemaNomeApi,
    montar: (argumentos) => ({ corpo: argumentos }),
  }),
};

function montarAnotacoes(endpoint: EndpointApi): FerramentaMcp['annotations'] {
  return {
    readOnlyHint: endpoint.metodo === 'GET',
    destructiveHint: endpoint.metodo === 'DELETE',
    idempotentHint: endpoint.metodo !== 'POST',
    openWorldHint: false,
  };
}

// O "$schema" do JSON Schema gerado é omitido: os clientes MCP assumem o
// dialeto padrão e a lista de ferramentas fica menor.
function montarEsquemaJson(entrada: z.ZodObject): Record<string, unknown> {
  const esquema: Record<string, unknown> = z.toJSONSchema(entrada, {
    io: 'input',
    unrepresentable: 'any',
  });
  delete esquema.$schema;
  return esquema;
}

type FerramentaRegistrada = {
  endpoint: EndpointApi;
  definicao: DefinicaoFerramenta;
  publicada: FerramentaMcp;
};

const FERRAMENTAS_REGISTRADAS: readonly FerramentaRegistrada[] = (
  Object.keys(DEFINICOES) as ChaveEndpoint[]
).map((chave) => {
  const endpoint: EndpointApi = ENDPOINTS_API[chave];
  const definicao = DEFINICOES[chave];
  return {
    endpoint,
    definicao,
    publicada: {
      name: definicao.nome,
      title: definicao.titulo,
      description: [
        endpoint.descricao,
        definicao.dica,
        `Permissão: ${endpoint.permissoes.join(', ') || 'qualquer token'}.`,
      ]
        .filter(Boolean)
        .join(' '),
      inputSchema: montarEsquemaJson(definicao.entrada),
      annotations: montarAnotacoes(endpoint),
    },
  };
});

export const FERRAMENTAS_MCP: readonly FerramentaMcp[] =
  FERRAMENTAS_REGISTRADAS.map((ferramenta) => ferramenta.publicada);

// Monta a chamada HTTP de uma ferramenta: confere os argumentos (o agente
// recebe o erro como resultado, para corrigir e tentar de novo) e aplica o
// identificador no caminho do catálogo.
export function montarRequisicaoFerramenta(
  nome: string,
  argumentos: Record<string, unknown>,
): RequisicaoApi | { erro: string } {
  const ferramenta = FERRAMENTAS_REGISTRADAS.find(
    (item) => item.definicao.nome === nome,
  );
  if (!ferramenta) {
    return { erro: nome };
  }
  const validacao = ferramenta.definicao.entrada.safeParse(argumentos);
  if (!validacao.success) {
    return { erro: z.prettifyError(validacao.error) };
  }
  const { id, anexoId, consulta, corpo, arquivos } =
    ferramenta.definicao.montar(validacao.data as Record<string, unknown>);
  return {
    metodo: ferramenta.endpoint.metodo,
    caminho: ferramenta.endpoint.caminho
      .replace(MARCADOR_ID, String(id))
      .replace(MARCADOR_ANEXO_ID, String(anexoId)),
    consulta,
    corpo,
    arquivos,
  };
}

export async function executarFerramenta(
  configuracao: ConfiguracaoCliente,
  nome: string,
  argumentos: Record<string, unknown>,
): Promise<ResultadoFerramenta> {
  const requisicao = montarRequisicaoFerramenta(nome, argumentos);
  if ('erro' in requisicao) {
    return {
      content: [
        { type: 'text', text: textosMcp.argumentosInvalidos(requisicao.erro) },
      ],
      isError: true,
    };
  }
  return chamarApi(configuracao, requisicao);
}
