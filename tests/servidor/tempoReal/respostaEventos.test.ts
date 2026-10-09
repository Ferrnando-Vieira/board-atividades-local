import {
  obterCanalAlteracoes,
  publicarAlteracaoBoard,
} from '@/servidor/tempoReal/alteracoesBoard';
import {
  formatarEventoAlteracao,
  responderEventosBoard,
} from '@/servidor/web/respostaEventos';

const decodificador = new TextDecoder();

async function lerTrecho(
  leitor: ReadableStreamDefaultReader<Uint8Array>,
): Promise<string> {
  const { value } = await leitor.read();
  return decodificador.decode(value);
}

describe('respostaEventos', () => {
  it('formata o aviso de alteração no padrão SSE', () => {
    expect(formatarEventoAlteracao(7)).toBe('event: alteracao\ndata: 7\n\n');
  });

  it('abre com a revisão atual, repassa alterações e solta a assinatura ao abortar', async () => {
    const canal = obterCanalAlteracoes();
    const abortador = new AbortController();
    const resposta = responderEventosBoard(
      new Request('http://localhost/eventos', { signal: abortador.signal }),
    );
    expect(resposta.headers.get('content-type')).toContain('text/event-stream');
    expect(resposta.headers.get('cache-control')).toContain('no-transform');
    const leitor = resposta.body!.getReader();

    expect(await lerTrecho(leitor)).toBe('retry: 5000\n\n');
    expect(await lerTrecho(leitor)).toBe(
      formatarEventoAlteracao(canal.revisao),
    );
    expect(canal.ouvintes.size).toBe(1);

    publicarAlteracaoBoard();
    expect(await lerTrecho(leitor)).toBe(
      formatarEventoAlteracao(canal.revisao),
    );

    abortador.abort();
    expect(canal.ouvintes.size).toBe(0);
    await leitor.cancel();
  });
});
