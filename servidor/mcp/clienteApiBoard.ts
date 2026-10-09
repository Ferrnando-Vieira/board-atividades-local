import { openAsBlob } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ehImagemExibivel, LIMITES_ANEXO } from '@/config/anexos';
import { PREFIXO_API } from '@/config/rotas';
import { CAMPO_ARQUIVO_API, type MetodoApi } from '@/servidor/api/catalogoApi';
import type { ResultadoFerramenta } from '@/servidor/mcp/protocoloMcp';
import { textosMcp as textos } from '@/servidor/mcp/textosMcp';
import { formatarTamanhoArquivo } from '@/util/ArquivoUtils';

const TEMPO_LIMITE_MS = 15_000;
const MILISSEGUNDOS_POR_SEGUNDO = 1000;
const SEM_CONTEUDO = 204;
const RECUO_JSON = 2;
const TIPO_CONTEUDO_JSON = 'application/json';
const TIPOS_CONTEUDO_TEXTO = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
]);
// A API do Claude recusa imagem cujo base64 passe de 5 MiB.
const TAMANHO_MAXIMO_IMAGEM_BASE64 = 5 * 1024 * 1024;

export type ValorConsulta =
  string | number | boolean | readonly (string | number)[];

export type RequisicaoApi = {
  metodo: MetodoApi;
  // Caminho do catálogo, já com os parâmetros substituídos (/api/v1/...).
  caminho: string;
  consulta?: Record<string, ValorConsulta | undefined>;
  corpo?: Record<string, unknown>;
  // Caminhos absolutos de arquivos desta máquina, enviados em multipart.
  arquivos?: readonly string[];
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

type CorpoRequisicao = {
  corpo?: BodyInit;
  cabecalhos: Record<string, string>;
};

class ErroArquivoLocal extends Error {}

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

async function medirArquivoLocal(caminho: string): Promise<number | null> {
  try {
    const informacoes = await fs.stat(caminho);
    return informacoes.isFile() ? informacoes.size : null;
  } catch {
    return null;
  }
}

async function exigirTamanhoArquivoLocal(caminho: string): Promise<number> {
  const tamanhoBytes = await medirArquivoLocal(caminho);
  if (tamanhoBytes === null) {
    throw new ErroArquivoLocal(textos.arquivoLocalInexistente(caminho));
  }
  if (tamanhoBytes > LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES) {
    throw new ErroArquivoLocal(
      textos.arquivoLocalGrande(
        caminho,
        formatarTamanhoArquivo(LIMITES_ANEXO.TAMANHO_MAXIMO_BYTES),
      ),
    );
  }
  return tamanhoBytes;
}

async function exigirTamanhosLocais(
  caminhos: readonly string[],
): Promise<void> {
  let total = 0;
  for (const caminho of caminhos) {
    total += await exigirTamanhoArquivoLocal(caminho);
  }
  if (total > LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES) {
    throw new ErroArquivoLocal(
      textos.envioLocalGrande(
        formatarTamanhoArquivo(LIMITES_ANEXO.TAMANHO_MAXIMO_ENVIO_BYTES),
      ),
    );
  }
}

async function abrirArquivoLocal(caminho: string): Promise<Blob> {
  try {
    return await openAsBlob(caminho);
  } catch {
    throw new ErroArquivoLocal(textos.arquivoLocalInexistente(caminho));
  }
}

// O servidor MCP envia o arquivo sem carregá-lo inteiro: base64 nos
// argumentos custaria dezenas de milhares de tokens por imagem. Tipo e
// conteúdo são conferidos pela API.
async function montarFormularioArquivos(
  caminhos: readonly string[],
): Promise<FormData> {
  await exigirTamanhosLocais(caminhos);
  const formulario = new FormData();
  for (const caminho of caminhos) {
    formulario.append(
      CAMPO_ARQUIVO_API,
      await abrirArquivoLocal(caminho),
      path.basename(caminho),
    );
  }
  return formulario;
}

async function montarCorpo(
  requisicao: RequisicaoApi,
): Promise<CorpoRequisicao> {
  if (requisicao.arquivos) {
    return {
      corpo: await montarFormularioArquivos(requisicao.arquivos),
      cabecalhos: {},
    };
  }
  if (requisicao.corpo) {
    return {
      corpo: JSON.stringify(requisicao.corpo),
      cabecalhos: { 'Content-Type': TIPO_CONTEUDO_JSON },
    };
  }
  return { cabecalhos: {} };
}

function ehTempoEsgotado(erro: unknown): boolean {
  return erro instanceof DOMException && erro.name === 'TimeoutError';
}

function lerTipoConteudo(resposta: Response): string {
  return (
    (resposta.headers.get('content-type') ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase() ?? ''
  );
}

// Imagem vira conteúdo "image" do MCP, que o modelo enxerga; texto vira
// texto; os demais tipos só são descritos.
async function converterArquivo(
  resposta: Response,
  tipoConteudo: string,
): Promise<ResultadoFerramenta> {
  const bytes = Buffer.from(await resposta.arrayBuffer());
  const tamanho = formatarTamanhoArquivo(bytes.byteLength);
  if (ehImagemExibivel(tipoConteudo)) {
    const base64 = bytes.toString('base64');
    return base64.length > TAMANHO_MAXIMO_IMAGEM_BASE64
      ? resultadoTexto(textos.imagemGrande(tamanho))
      : {
          content: [{ type: 'image', data: base64, mimeType: tipoConteudo }],
        };
  }
  if (TIPOS_CONTEUDO_TEXTO.has(tipoConteudo)) {
    return resultadoTexto(new TextDecoder().decode(bytes));
  }
  return resultadoTexto(textos.arquivoSemVisualizacao(tipoConteudo, tamanho));
}

async function converterDados(
  resposta: Response,
): Promise<ResultadoFerramenta> {
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

// Chama a API HTTP do board (a única forma suportada de integrar) e converte
// a resposta em resultado de ferramenta MCP: dados em JSON legível, arquivo
// como imagem ou texto, ou erro com código e campos para o agente corrigir e
// tentar de novo.
export async function chamarApi(
  configuracao: ConfiguracaoCliente,
  requisicao: RequisicaoApi,
): Promise<ResultadoFerramenta> {
  if (!configuracao.token) {
    return resultadoTexto(textos.tokenAusente, true);
  }
  let corpo: CorpoRequisicao;
  try {
    corpo = await montarCorpo(requisicao);
  } catch (erro) {
    if (erro instanceof ErroArquivoLocal) {
      return resultadoTexto(erro.message, true);
    }
    throw erro;
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
          ...corpo.cabecalhos,
        },
        body: corpo.corpo,
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      },
    );
  } catch (erro) {
    return resultadoTexto(
      ehTempoEsgotado(erro)
        ? textos.tempoEsgotado(TEMPO_LIMITE_MS / MILISSEGUNDOS_POR_SEGUNDO)
        : textos.boardIndisponivel(configuracao.urlApi),
      true,
    );
  }
  if (resposta.status === SEM_CONTEUDO) {
    return resultadoTexto(textos.semConteudo);
  }
  const tipoConteudo = lerTipoConteudo(resposta);
  return resposta.ok && tipoConteudo !== TIPO_CONTEUDO_JSON
    ? converterArquivo(resposta, tipoConteudo)
    : converterDados(resposta);
}
