import { z } from 'zod';
import { CODIGOS_ERRO_API, mensagensApi } from '@/servidor/api/mensagensApi';
import { CODIGO_BANCO_AUSENTE } from '@/servidor/web/bancoAplicacao';
import type { ConteudoAnexo } from '@/servidor/anexos/armazenamentoAnexos';
import type { AnexoParaDownload } from '@/servidor/anexos/consultasAnexos';
import {
  CABECALHOS_ARQUIVO_PRIVADO,
  montarCabecalhoDownload,
} from '@/util/ArquivoUtils';
import { ehErroApp, ErroApp, STATUS_ERRO } from '@/util/ErroApp';

const CABECALHOS_JSON = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
} as const;

export type DetalheErroApi = {
  codigo: string;
  mensagem: string;
  campos?: Record<string, string[]>;
  gerais?: string[];
};

type Cabecalhos = Record<string, string>;

// Erro com cabeçalhos próprios da resposta (WWW-Authenticate no 401, Allow
// no 405), que o formato JSON sozinho não carrega.
export class ErroApiComCabecalhos extends ErroApp {
  readonly cabecalhos: Cabecalhos;

  constructor(
    mensagem: string,
    opcoes: { status: number; codigo: string; cabecalhos: Cabecalhos },
  ) {
    super(mensagem, { status: opcoes.status, codigo: opcoes.codigo });
    this.name = 'ErroApiComCabecalhos';
    this.cabecalhos = opcoes.cabecalhos;
  }
}

function extrairCampos(
  errosCampos: Partial<Record<string, string[]>>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(errosCampos).flatMap(([campo, mensagens]) =>
      mensagens && mensagens.length > 0 ? [[campo, mensagens]] : [],
    ),
  );
}

export class ErroValidacaoApi extends ErroApp {
  readonly campos: Record<string, string[]>;
  readonly gerais: string[];

  constructor(erro: z.ZodError) {
    super(mensagensApi.dadosInvalidos, {
      status: STATUS_ERRO.REQUISICAO_INVALIDA,
      codigo: CODIGOS_ERRO_API.DADOS_INVALIDOS,
    });
    this.name = 'ErroValidacaoApi';
    const { formErrors, fieldErrors } = z.flattenError(erro);
    this.campos = extrairCampos(fieldErrors);
    this.gerais = formErrors;
  }
}

export function responderDados(
  dados: unknown,
  status: number,
  cabecalhos: Cabecalhos = {},
): Response {
  return new Response(JSON.stringify({ dados }), {
    status,
    headers: { ...CABECALHOS_JSON, ...cabecalhos },
  });
}

export function responderErro(
  status: number,
  erro: DetalheErroApi,
  cabecalhos: Cabecalhos = {},
): Response {
  return new Response(JSON.stringify({ erro }), {
    status,
    headers: { ...CABECALHOS_JSON, ...cabecalhos },
  });
}

// O tipo é o gravado no envio (do catálogo, conferido pela assinatura), nunca
// o declarado por quem enviou.
export function responderArquivo(
  anexo: AnexoParaDownload,
  conteudo: ConteudoAnexo,
): Response {
  return new Response(conteudo.fluxo, {
    headers: {
      ...CABECALHOS_ARQUIVO_PRIVADO,
      'Content-Type': anexo.tipoConteudo,
      'Content-Disposition': montarCabecalhoDownload(anexo.nomeOriginal),
      'Content-Length': String(conteudo.tamanhoBytes),
    },
  });
}

function detalharValidacao(erro: ErroValidacaoApi): DetalheErroApi {
  return {
    codigo: erro.codigo,
    mensagem: erro.message,
    ...(Object.keys(erro.campos).length > 0 ? { campos: erro.campos } : {}),
    ...(erro.gerais.length > 0 ? { gerais: erro.gerais } : {}),
  };
}

// Erros de negócio (4xx) chegam ao agente com código e mensagem do domínio;
// qualquer outro vira 500 genérico, com o detalhe só no log do servidor.
export function converterErroEmResposta(erro: unknown): Response {
  if (erro instanceof ErroValidacaoApi) {
    return responderErro(erro.status, detalharValidacao(erro));
  }
  if (ehErroApp(erro) && erro.codigo === CODIGO_BANCO_AUSENTE) {
    return responderErro(STATUS_ERRO.INDISPONIVEL, {
      codigo: CODIGOS_ERRO_API.INSTALACAO_INCOMPLETA,
      mensagem: mensagensApi.instalacaoIncompleta,
    });
  }
  if (ehErroApp(erro) && erro.status < STATUS_ERRO.INTERNO) {
    return responderErro(
      erro.status,
      { codigo: erro.codigo, mensagem: erro.message },
      erro instanceof ErroApiComCabecalhos ? erro.cabecalhos : {},
    );
  }
  if (ehErroApp(erro) && erro.status === STATUS_ERRO.INDISPONIVEL) {
    return responderErro(erro.status, {
      codigo: erro.codigo,
      mensagem: erro.message,
    });
  }
  console.error(erro);
  return responderErro(STATUS_ERRO.INTERNO, {
    codigo: CODIGOS_ERRO_API.ERRO_INTERNO,
    mensagem: mensagensApi.erroInterno,
  });
}
