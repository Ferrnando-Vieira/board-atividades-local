import { PREFIXO_API } from '@/config/rotas';
import type { MetodoApi } from '@/servidor/api/catalogoApi';
import type { ResultadoFerramenta } from '@/servidor/mcp/protocoloMcp';
import { textosMcp as textos } from '@/servidor/mcp/textosMcp';

const TEMPO_LIMITE_MS = 15_000;
const SEM_CONTEUDO = 204;
const RECUO_JSON = 2;

export type ValorConsulta =
  string | number | boolean | readonly (string | number)[];

export type RequisicaoApi = {
  metodo: MetodoApi;
  // Caminho do catálogo, já com os parâmetros substituídos (/api/v1/...).
  caminho: string;
  consulta?: Record<string, ValorConsulta | undefined>;
  corpo?: Record<string, unknown>;
};

export type ConfiguracaoCliente = {
  urlApi: string;
  token: string | null;
  // Injetável nos testes.
  buscar?: typeof fetch;
};

type ErroDaApi = {
  codigo?: string;
  mensagem?: string;
  campos?: Record<string, string[]>;
  gerais?: string[];
};

// A URL configurada pode ter outro prefixo (proxy): o caminho do catálogo é
// aplicado sobre ela, sem o /api/v1 repetido.
export function montarUrl(
  urlApi: string,
  caminho: string,
  consulta: RequisicaoApi['consulta'] = {},
): string {
  const relativo = caminho.startsWith(PREFIXO_API)
    ? caminho.slice(PREFIXO_API.length)
    : caminho;
  const url = new URL(`${urlApi.replace(/\/+$/, '')}${relativo}`);
  for (const [nome, valor] of Object.entries(consulta)) {
    if (valor === undefined) {
      continue;
    }
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      url.searchParams.append(nome, String(item));
    }
  }
  return url.toString();
}

function resultadoTexto(texto: string, erro = false): ResultadoFerramenta {
  return {
    content: [{ type: 'text', text: texto }],
    ...(erro ? { isError: true } : {}),
  };
}

function descreverErro(status: number, erro: ErroDaApi | undefined): string {
  const linhas = [
    textos.erroApi(status, erro?.codigo ?? 'erro', erro?.mensagem ?? ''),
  ];
  for (const [campo, mensagens] of Object.entries(erro?.campos ?? {})) {
    linhas.push(`- ${campo}: ${mensagens.join(' ')}`);
  }
  for (const mensagem of erro?.gerais ?? []) {
    linhas.push(`- ${mensagem}`);
  }
  return linhas.join('\n');
}

// Chama a API HTTP do board (a única forma suportada de integrar) e converte
// a resposta em resultado de ferramenta MCP: dados em JSON legível, ou erro
// com código e campos para o agente corrigir e tentar de novo.
export async function chamarApi(
  configuracao: ConfiguracaoCliente,
  requisicao: RequisicaoApi,
): Promise<ResultadoFerramenta> {
  if (!configuracao.token) {
    return resultadoTexto(textos.tokenAusente, true);
  }
  const buscar = configuracao.buscar ?? fetch;
  let resposta: Response;
  try {
    resposta = await buscar(
      montarUrl(configuracao.urlApi, requisicao.caminho, requisicao.consulta),
      {
        method: requisicao.metodo,
        headers: {
          Authorization: `Bearer ${configuracao.token}`,
          Accept: 'application/json',
          ...(requisicao.corpo ? { 'Content-Type': 'application/json' } : {}),
        },
        body: requisicao.corpo ? JSON.stringify(requisicao.corpo) : undefined,
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      },
    );
  } catch {
    return resultadoTexto(textos.boardIndisponivel(configuracao.urlApi), true);
  }
  if (resposta.status === SEM_CONTEUDO) {
    return resultadoTexto(textos.semConteudo);
  }
  let corpo: { dados?: unknown; erro?: ErroDaApi } | undefined;
  try {
    corpo = (await resposta.json()) as typeof corpo;
  } catch {
    corpo = undefined;
  }
  if (!resposta.ok) {
    return resultadoTexto(descreverErro(resposta.status, corpo?.erro), true);
  }
  const dados = corpo?.dados ?? null;
  return {
    content: [{ type: 'text', text: JSON.stringify(dados, null, RECUO_JSON) }],
    structuredContent: { dados },
  };
}
