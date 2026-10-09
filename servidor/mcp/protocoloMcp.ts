// Núcleo do protocolo MCP (Model Context Protocol) por JSON-RPC 2.0, sem
// SDK: só o necessário para um servidor de ferramentas — initialize, ping,
// tools/list e tools/call. Não depende de stdio nem de rede; o script de
// entrada lê as linhas e escreve as respostas.

// Da mais nova para a mais antiga; um cliente que pede outra recebe a mais
// nova, como manda a negociação de versão do protocolo.
export const VERSOES_PROTOCOLO = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
] as const;

export const CODIGOS_ERRO_JSON_RPC = {
  JSON_INVALIDO: -32700,
  REQUISICAO_INVALIDA: -32600,
  METODO_INEXISTENTE: -32601,
  PARAMETROS_INVALIDOS: -32602,
  ERRO_INTERNO: -32603,
} as const;

const VERSAO_JSON_RPC = '2.0';
const PREFIXO_NOTIFICACAO = 'notifications/';

type IdJsonRpc = string | number;

export type AnotacoesFerramenta = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export type FerramentaMcp = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: AnotacoesFerramenta;
};

export type ConteudoTexto = { type: 'text'; text: string };

export type ConteudoImagem = { type: 'image'; data: string; mimeType: string };

export type ResultadoFerramenta = {
  content: (ConteudoTexto | ConteudoImagem)[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export type OpcoesServidorMcp = {
  nome: string;
  titulo: string;
  versao: string;
  instrucoes: string;
  ferramentas: readonly FerramentaMcp[];
  executar: (
    nome: string,
    argumentos: Record<string, unknown>,
  ) => Promise<ResultadoFerramenta>;
};

type RespostaJsonRpc =
  | { jsonrpc: typeof VERSAO_JSON_RPC; id: IdJsonRpc | null; result: unknown }
  | {
      jsonrpc: typeof VERSAO_JSON_RPC;
      id: IdJsonRpc | null;
      error: { code: number; message: string };
    };

class ErroJsonRpc extends Error {
  constructor(
    readonly codigo: number,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ehId(valor: unknown): valor is IdJsonRpc {
  return typeof valor === 'string' || typeof valor === 'number';
}

function responderErro(
  id: IdJsonRpc | null,
  codigo: number,
  mensagem: string,
): RespostaJsonRpc {
  return {
    jsonrpc: VERSAO_JSON_RPC,
    id,
    error: { code: codigo, message: mensagem },
  };
}

export function negociarVersao(pedida: unknown): string {
  return typeof pedida === 'string' &&
    (VERSOES_PROTOCOLO as readonly string[]).includes(pedida)
    ? pedida
    : VERSOES_PROTOCOLO[0];
}

export function criarServidorMcp(opcoes: OpcoesServidorMcp) {
  const ferramentasPorNome = new Map(
    opcoes.ferramentas.map((ferramenta) => [ferramenta.name, ferramenta]),
  );

  async function executarMetodo(
    metodo: string,
    parametros: Record<string, unknown>,
  ): Promise<unknown> {
    switch (metodo) {
      case 'initialize':
        return {
          protocolVersion: negociarVersao(parametros.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: opcoes.nome,
            title: opcoes.titulo,
            version: opcoes.versao,
          },
          instructions: opcoes.instrucoes,
        };
      case 'ping':
        return {};
      case 'tools/list':
        return { tools: opcoes.ferramentas };
      case 'tools/call': {
        const nome = parametros.name;
        if (typeof nome !== 'string' || !ferramentasPorNome.has(nome)) {
          throw new ErroJsonRpc(
            CODIGOS_ERRO_JSON_RPC.PARAMETROS_INVALIDOS,
            `Ferramenta desconhecida: ${String(nome)}`,
          );
        }
        const argumentos = parametros.arguments ?? {};
        if (!ehObjeto(argumentos)) {
          throw new ErroJsonRpc(
            CODIGOS_ERRO_JSON_RPC.PARAMETROS_INVALIDOS,
            'Os argumentos da ferramenta devem ser um objeto.',
          );
        }
        return opcoes.executar(nome, argumentos);
      }
      default:
        throw new ErroJsonRpc(
          CODIGOS_ERRO_JSON_RPC.METODO_INEXISTENTE,
          `Método não suportado: ${metodo}`,
        );
    }
  }

  // Notificações (sem id, ou "notifications/...") nunca têm resposta.
  async function processarMensagem(
    mensagem: unknown,
  ): Promise<RespostaJsonRpc | null> {
    if (
      !ehObjeto(mensagem) ||
      mensagem.jsonrpc !== VERSAO_JSON_RPC ||
      typeof mensagem.method !== 'string'
    ) {
      // Resposta do cliente a algo que o servidor não pediu: ignorada.
      if (ehObjeto(mensagem) && ('result' in mensagem || 'error' in mensagem)) {
        return null;
      }
      const id = ehObjeto(mensagem) && ehId(mensagem.id) ? mensagem.id : null;
      return responderErro(
        id,
        CODIGOS_ERRO_JSON_RPC.REQUISICAO_INVALIDA,
        'Requisição JSON-RPC inválida.',
      );
    }
    const notificacao =
      !('id' in mensagem) || mensagem.method.startsWith(PREFIXO_NOTIFICACAO);
    const id = ehId(mensagem.id) ? mensagem.id : null;
    const parametros = ehObjeto(mensagem.params) ? mensagem.params : {};
    try {
      const resultado = await executarMetodo(mensagem.method, parametros);
      return notificacao
        ? null
        : { jsonrpc: VERSAO_JSON_RPC, id, result: resultado };
    } catch (erro) {
      if (notificacao) {
        return null;
      }
      return erro instanceof ErroJsonRpc
        ? responderErro(id, erro.codigo, erro.message)
        : responderErro(
            id,
            CODIGOS_ERRO_JSON_RPC.ERRO_INTERNO,
            erro instanceof Error ? erro.message : 'Erro interno.',
          );
    }
  }

  // Uma linha do stdio = uma mensagem JSON-RPC (ou um lote, nas versões que
  // o aceitavam). Devolve a linha de resposta, ou null quando não há nada a
  // responder.
  async function processarLinha(linha: string): Promise<string | null> {
    const texto = linha.trim();
    if (texto === '') {
      return null;
    }
    let mensagem: unknown;
    try {
      mensagem = JSON.parse(texto);
    } catch {
      return JSON.stringify(
        responderErro(
          null,
          CODIGOS_ERRO_JSON_RPC.JSON_INVALIDO,
          'JSON inválido.',
        ),
      );
    }
    if (Array.isArray(mensagem)) {
      const respostas = (
        await Promise.all(mensagem.map((item) => processarMensagem(item)))
      ).filter((resposta) => resposta !== null);
      return respostas.length > 0 ? JSON.stringify(respostas) : null;
    }
    const resposta = await processarMensagem(mensagem);
    return resposta ? JSON.stringify(resposta) : null;
  }

  return { processarLinha };
}
