export const STATUS_ERRO = {
  REQUISICAO_INVALIDA: 400,
  NAO_AUTORIZADO: 401,
  PROIBIDO: 403,
  NAO_ENCONTRADO: 404,
  METODO_NAO_PERMITIDO: 405,
  CONFLITO: 409,
  CORPO_GRANDE_DEMAIS: 413,
  TIPO_NAO_SUPORTADO: 415,
  BLOQUEADO: 423,
  INTERNO: 500,
  INDISPONIVEL: 503,
} as const;

type OpcoesErroApp = {
  status?: number;
  codigo?: string;
  causa?: unknown;
};

const CODIGO_ERRO_PADRAO = 'erro-interno';

export class ErroApp extends Error {
  readonly status: number;
  readonly codigo: string;

  constructor(mensagem: string, opcoes: OpcoesErroApp = {}) {
    super(mensagem, { cause: opcoes.causa });
    this.name = 'ErroApp';
    this.status = opcoes.status ?? STATUS_ERRO.INTERNO;
    this.codigo = opcoes.codigo ?? CODIGO_ERRO_PADRAO;
  }
}

export function ehErroApp(erro: unknown): erro is ErroApp {
  return erro instanceof ErroApp;
}
