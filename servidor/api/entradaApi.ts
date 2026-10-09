import { z } from 'zod';
import { LIMITES_CORPO_API } from '@/servidor/api/limitesApi';
import { CODIGOS_ERRO_API, mensagensApi } from '@/servidor/api/mensagensApi';
import { ErroValidacaoApi } from '@/servidor/api/respostasApi';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const TIPO_CONTEUDO_JSON = /^application\/json\s*(;|$)/i;
const TIPO_CONTEUDO_MULTIPART = /^multipart\/form-data\s*;/i;
const MAPA_ERROS_PT_BR = z.locales.ptBR().localeError;

// Mensagens próprias dos esquemas do domínio prevalecem; o mapa pt-BR só
// cobre as mensagens genéricas de tipo dos esquemas da API.
export function validarEntradaApi<E extends z.ZodType>(
  esquema: E,
  valor: unknown,
): z.output<E> {
  const resultado = esquema.safeParse(valor, { error: MAPA_ERROS_PT_BR });
  if (!resultado.success) {
    throw new ErroValidacaoApi(resultado.error);
  }
  return resultado.data;
}

function erroCorpoGrande(): ErroApp {
  return new ErroApp(mensagensApi.corpoGrande, {
    status: STATUS_ERRO.CORPO_GRANDE_DEMAIS,
    codigo: CODIGOS_ERRO_API.CORPO_GRANDE,
  });
}

function erroJsonInvalido(): ErroApp {
  return new ErroApp(mensagensApi.jsonInvalido, {
    status: STATUS_ERRO.REQUISICAO_INVALIDA,
    codigo: CODIGOS_ERRO_API.JSON_INVALIDO,
  });
}

function erroMultipartInvalido(): ErroApp {
  return new ErroApp(mensagensApi.multipartInvalido, {
    status: STATUS_ERRO.REQUISICAO_INVALIDA,
    codigo: CODIGOS_ERRO_API.MULTIPART_INVALIDO,
  });
}

function exigirTipoConteudo(
  requisicao: Request,
  formato: RegExp,
  mensagem: string,
): string {
  const tipoConteudo = requisicao.headers.get('content-type')?.trim() ?? '';
  if (!formato.test(tipoConteudo)) {
    throw new ErroApp(mensagem, {
      status: STATUS_ERRO.TIPO_NAO_SUPORTADO,
      codigo: CODIGOS_ERRO_API.TIPO_CONTEUDO,
    });
  }
  return tipoConteudo;
}

// O Fetch entrega os pedaços do corpo sobre ArrayBuffer; a cópia só acontece
// se algum vier sobre SharedArrayBuffer, que o Blob não aceita.
function ehVisaoDeArrayBuffer(
  pedaco: Uint8Array,
): pedaco is Uint8Array<ArrayBuffer> {
  return pedaco.buffer instanceof ArrayBuffer;
}

// Lê aos poucos e para no limite: um Content-Length ausente ou falso não
// faz o servidor carregar um corpo arbitrariamente grande na memória.
async function lerCorpoComLimite(
  requisicao: Request,
  limite: number,
  criarErroLimite: () => ErroApp,
): Promise<Blob> {
  if (Number(requisicao.headers.get('content-length')) > limite) {
    throw criarErroLimite();
  }
  if (!requisicao.body) {
    return new Blob([]);
  }
  const leitor = requisicao.body.getReader();
  const partes: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel();
      throw criarErroLimite();
    }
    partes.push(ehVisaoDeArrayBuffer(value) ? value : new Uint8Array(value));
  }
  return new Blob(partes);
}

export async function lerCorpoJson(requisicao: Request): Promise<unknown> {
  exigirTipoConteudo(requisicao, TIPO_CONTEUDO_JSON, mensagensApi.tipoConteudo);
  const corpo = await lerCorpoComLimite(
    requisicao,
    LIMITES_CORPO_API.BYTES_MAXIMOS,
    erroCorpoGrande,
  );
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        await corpo.arrayBuffer(),
      ),
    ) as unknown;
  } catch {
    throw erroJsonInvalido();
  }
}

export type ArquivoRecebidoApi = {
  nomeArquivo: string;
  conteudo: Uint8Array;
};

async function lerFormularioMultipart(
  corpo: Blob,
  tipoConteudo: string,
): Promise<FormData> {
  try {
    return await new Response(corpo, {
      headers: { 'content-type': tipoConteudo },
    }).formData();
  } catch {
    throw erroMultipartInvalido();
  }
}

function exigirApenasCampo(formulario: FormData, campo: string): void {
  const desconhecidos = [...new Set(formulario.keys())].filter(
    (nome) => nome !== campo,
  );
  if (desconhecidos.length > 0) {
    throw new ErroApp(mensagensApi.campoDesconhecido(desconhecidos), {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ERRO_API.DADOS_INVALIDOS,
    });
  }
}

async function lerArquivoRecebido(
  valor: FormDataEntryValue,
): Promise<ArquivoRecebidoApi> {
  if (!(valor instanceof File)) {
    throw erroMultipartInvalido();
  }
  return {
    nomeArquivo: valor.name,
    conteudo: new Uint8Array(await valor.arrayBuffer()),
  };
}

// Quantidade, tamanho, tipo e assinatura de cada arquivo são conferidos pelo
// serviço de anexos, com as mesmas regras do envio pela tela.
export async function lerArquivosMultipart(
  requisicao: Request,
  campo: string,
  criarErroLimite: () => ErroApp,
): Promise<ArquivoRecebidoApi[]> {
  const tipoConteudo = exigirTipoConteudo(
    requisicao,
    TIPO_CONTEUDO_MULTIPART,
    mensagensApi.tipoConteudoArquivos,
  );
  const corpo = await lerCorpoComLimite(
    requisicao,
    LIMITES_CORPO_API.BYTES_MAXIMOS_ARQUIVOS,
    criarErroLimite,
  );
  const formulario = await lerFormularioMultipart(corpo, tipoConteudo);
  exigirApenasCampo(formulario, campo);
  return Promise.all(formulario.getAll(campo).map(lerArquivoRecebido));
}

type DefinicaoParametros = {
  listas?: readonly string[];
  unicos?: readonly string[];
};

// Parâmetro desconhecido (por exemplo "tags" no lugar de "tag") é recusado
// em vez de ignorado: um filtro digitado errado não pode virar "sem filtro".
export function lerParametrosConsulta(
  requisicao: Request,
  { listas = [], unicos = [] }: DefinicaoParametros,
): Record<string, string | string[] | undefined> {
  const parametros = new URL(requisicao.url).searchParams;
  const conhecidos = new Set([...listas, ...unicos]);
  const desconhecidos = [...new Set(parametros.keys())].filter(
    (nome) => !conhecidos.has(nome),
  );
  if (desconhecidos.length > 0) {
    throw new ErroApp(mensagensApi.parametroDesconhecido(desconhecidos), {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ERRO_API.PARAMETRO_DESCONHECIDO,
    });
  }
  const valores: Record<string, string | string[] | undefined> = {};
  for (const nome of listas) {
    valores[nome] = parametros.getAll(nome);
  }
  for (const nome of unicos) {
    const encontrados = parametros.getAll(nome);
    if (encontrados.length > 1) {
      throw new ErroApp(mensagensApi.parametroRepetido(nome), {
        status: STATUS_ERRO.REQUISICAO_INVALIDA,
        codigo: CODIGOS_ERRO_API.DADOS_INVALIDOS,
      });
    }
    valores[nome] = encontrados[0];
  }
  return valores;
}
