import {
  assinarAlteracoes,
  obterCanalAlteracoes,
} from '@/servidor/tempoReal/alteracoesBoard';

// `no-transform` impede a compressão do servidor de segurar os eventos no
// buffer; `X-Accel-Buffering` faz o mesmo num proxy reverso, se houver.
const CABECALHOS_EVENTOS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;
const CABECALHOS_RECUSA = { 'Cache-Control': 'no-store' } as const;

export const EVENTOS = {
  NOME_ALTERACAO: 'alteracao',
  // Comentário periódico: mantém a conexão viva em proxies e no navegador.
  INTERVALO_BATIMENTO_MS: 25_000,
  // Espera do navegador antes de reconectar.
  ESPERA_RECONEXAO_MS: 5_000,
  // A conexão é encerrada de tempos em tempos; o navegador reconecta e o
  // acesso (sessão ou link) é conferido de novo pela rota.
  DURACAO_MAXIMA_MS: 10 * 60 * 1000,
} as const;

const codificador = new TextEncoder();

export function responderSemAcessoEventos(status: number): Response {
  return new Response(null, { status, headers: CABECALHOS_RECUSA });
}

export function formatarEventoAlteracao(revisao: number): string {
  return `event: ${EVENTOS.NOME_ALTERACAO}\ndata: ${revisao}\n\n`;
}

// O acesso é conferido pela rota antes. Cada conexão assina o canal de
// alterações e repassa só a revisão; quem decide o que mostrar é a página,
// ao recarregar. A revisão atual vai logo na abertura: ao reconectar, a aba
// compara com a última que viu e só recarrega se algo mudou no intervalo.
export function responderEventosBoard(requisicao: Request): Response {
  let encerrar: () => void = () => undefined;
  const fluxo = new ReadableStream<Uint8Array>({
    start(controlador) {
      let encerrado = false;
      function enviar(texto: string): void {
        if (!encerrado) {
          controlador.enqueue(codificador.encode(texto));
        }
      }
      const canal = obterCanalAlteracoes();
      const cancelarAssinatura = assinarAlteracoes(canal, (revisao) =>
        enviar(formatarEventoAlteracao(revisao)),
      );
      if (!cancelarAssinatura) {
        controlador.close();
        return;
      }
      const batimento = setInterval(
        () => enviar(': batimento\n\n'),
        EVENTOS.INTERVALO_BATIMENTO_MS,
      );
      const limite = setTimeout(() => {
        encerrar();
        controlador.close();
      }, EVENTOS.DURACAO_MAXIMA_MS);
      encerrar = () => {
        if (encerrado) {
          return;
        }
        encerrado = true;
        cancelarAssinatura();
        clearInterval(batimento);
        clearTimeout(limite);
        requisicao.signal.removeEventListener('abort', encerrar);
      };
      requisicao.signal.addEventListener('abort', encerrar);
      enviar(`retry: ${EVENTOS.ESPERA_RECONEXAO_MS}\n\n`);
      enviar(formatarEventoAlteracao(canal.revisao));
    },
    cancel() {
      encerrar();
    },
  });
  return new Response(fluxo, { headers: CABECALHOS_EVENTOS });
}
