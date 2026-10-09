import {
  CODIGOS_ERRO_JSON_RPC,
  criarServidorMcp,
  negociarVersao,
  VERSOES_PROTOCOLO,
  type FerramentaMcp,
} from '@/servidor/mcp/protocoloMcp';

const FERRAMENTA: FerramentaMcp = {
  name: 'eco',
  title: 'Eco',
  description: 'Devolve os argumentos.',
  inputSchema: { type: 'object' },
  annotations: { readOnlyHint: true },
};

function criarServidor() {
  const executar = jest.fn((_nome: string, argumentos: object) =>
    Promise.resolve({
      content: [{ type: 'text' as const, text: JSON.stringify(argumentos) }],
    }),
  );
  const servidor = criarServidorMcp({
    nome: 'teste',
    titulo: 'Servidor de teste',
    versao: '1.0.0',
    instrucoes: 'Instruções.',
    ferramentas: [FERRAMENTA],
    executar,
  });
  return { servidor, executar };
}

async function enviar(
  servidor: ReturnType<typeof criarServidor>['servidor'],
  mensagem: unknown,
): Promise<unknown> {
  const resposta = await servidor.processarLinha(
    typeof mensagem === 'string' ? mensagem : JSON.stringify(mensagem),
  );
  return resposta === null ? null : JSON.parse(resposta);
}

describe('protocoloMcp', () => {
  it('deve responder o initialize com a versão pedida, capacidades e identificação', async () => {
    const { servidor } = criarServidor();

    const resposta = await enviar(servidor, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {} },
    });

    expect(resposta).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: 'teste',
          title: 'Servidor de teste',
          version: '1.0.0',
        },
        instructions: 'Instruções.',
      },
    });
  });

  it('deve oferecer a versão mais nova quando o cliente pede outra', () => {
    expect(negociarVersao('1999-01-01')).toBe(VERSOES_PROTOCOLO[0]);
    expect(negociarVersao('2024-11-05')).toBe('2024-11-05');
  });

  it('não deve responder notificações', async () => {
    const { servidor } = criarServidor();

    expect(
      await enviar(servidor, {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    ).toBeNull();
  });

  it('deve responder ping e listar as ferramentas', async () => {
    const { servidor } = criarServidor();

    const ping = await enviar(servidor, {
      jsonrpc: '2.0',
      id: 'a',
      method: 'ping',
    });
    const lista = await enviar(servidor, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });

    expect(ping).toEqual({ jsonrpc: '2.0', id: 'a', result: {} });
    expect(lista).toEqual({
      jsonrpc: '2.0',
      id: 2,
      result: { tools: [FERRAMENTA] },
    });
  });

  it('deve chamar a ferramenta com os argumentos', async () => {
    const { servidor, executar } = criarServidor();

    const resposta = await enviar(servidor, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'eco', arguments: { x: 1 } },
    });

    expect(executar).toHaveBeenCalledWith('eco', { x: 1 });
    expect(resposta).toEqual({
      jsonrpc: '2.0',
      id: 3,
      result: { content: [{ type: 'text', text: '{"x":1}' }] },
    });
  });

  it.each([
    [
      'ferramenta desconhecida',
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nada' } },
      CODIGOS_ERRO_JSON_RPC.PARAMETROS_INVALIDOS,
    ],
    [
      'argumentos que não são objeto',
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'eco', arguments: [1] },
      },
      CODIGOS_ERRO_JSON_RPC.PARAMETROS_INVALIDOS,
    ],
    [
      'método inexistente',
      { jsonrpc: '2.0', id: 4, method: 'resources/list' },
      CODIGOS_ERRO_JSON_RPC.METODO_INEXISTENTE,
    ],
    [
      'versão do JSON-RPC errada',
      { jsonrpc: '1.0', id: 4, method: 'ping' },
      CODIGOS_ERRO_JSON_RPC.REQUISICAO_INVALIDA,
    ],
  ])('deve responder erro para %s', async (_caso, mensagem, codigo) => {
    const { servidor } = criarServidor();

    expect(await enviar(servidor, mensagem)).toEqual(
      expect.objectContaining({
        id: 4,
        error: expect.objectContaining({ code: codigo }),
      }),
    );
  });

  it('deve responder erro de JSON inválido com id nulo', async () => {
    const { servidor } = criarServidor();

    expect(await enviar(servidor, '{"jsonrpc":')).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: CODIGOS_ERRO_JSON_RPC.JSON_INVALIDO,
        message: 'JSON inválido.',
      },
    });
  });

  it('deve ignorar linhas vazias e respostas do cliente', async () => {
    const { servidor } = criarServidor();

    expect(await servidor.processarLinha('   ')).toBeNull();
    expect(
      await enviar(servidor, { jsonrpc: '2.0', id: 9, result: {} }),
    ).toBeNull();
  });

  it('deve atender um lote de mensagens', async () => {
    const { servidor } = criarServidor();

    const resposta = await enviar(servidor, [
      { jsonrpc: '2.0', id: 1, method: 'ping' },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'ping' },
    ]);

    expect(resposta).toEqual([
      { jsonrpc: '2.0', id: 1, result: {} },
      { jsonrpc: '2.0', id: 2, result: {} },
    ]);
  });
});
