import { z } from 'zod';
import { LIMITES_CORPO_API } from '@/servidor/api/limitesApi';
import { CODIGOS_ERRO_API, mensagensApi } from '@/servidor/api/mensagensApi';
import { ErroValidacaoApi } from '@/servidor/api/respostasApi';
import { ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const TIPO_CONTEUDO_JSON = /^application\/json\s*(;|$)/i;
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

// Lê aos poucos e para no limite: um Content-Length ausente ou falso não
// faz o servidor carregar um corpo arbitrariamente grande na memória.
async function lerBytesComLimite(
  corpo: ReadableStream<Uint8Array> | null,
  limite: number,
): Promise<Buffer> {
  if (!corpo) {
    return Buffer.alloc(0);
  }
  const leitor = corpo.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel();
      throw erroCorpoGrande();
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}

export async function lerCorpoJson(requisicao: Request): Promise<unknown> {
  const tipoConteudo = requisicao.headers.get('content-type')?.trim() ?? '';
  if (!TIPO_CONTEUDO_JSON.test(tipoConteudo)) {
    throw new ErroApp(mensagensApi.tipoConteudo, {
      status: STATUS_ERRO.TIPO_NAO_SUPORTADO,
      codigo: CODIGOS_ERRO_API.TIPO_CONTEUDO,
    });
  }
  const tamanhoDeclarado = Number(requisicao.headers.get('content-length'));
  if (tamanhoDeclarado > LIMITES_CORPO_API.BYTES_MAXIMOS) {
    throw erroCorpoGrande();
  }
  const bytes = await lerBytesComLimite(
    requisicao.body,
    LIMITES_CORPO_API.BYTES_MAXIMOS,
  );
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    ) as unknown;
  } catch {
    throw erroJsonInvalido();
  }
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
