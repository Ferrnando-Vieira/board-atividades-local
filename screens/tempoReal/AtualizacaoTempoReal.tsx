'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ContextoNavegacao } from '@/types/acesso';

const ROTA_EVENTOS = '/eventos';
const EVENTO_ALTERACAO = 'alteracao';
// Várias alterações seguidas (mover vários cards, uma rodada de MCP) viram
// uma recarga só.
const ESPERA_AGRUPAMENTO_MS = 300;

type PropriedadesAtualizacaoTempoReal = {
  contexto: ContextoNavegacao;
};

// Recarrega a tela quando o board muda em outra aba, aparelho ou pela API.
// O servidor avisa por SSE só a revisão; os dados vêm da recarga, com o
// acesso desta aba. Em segundo plano a recarga espera a aba voltar.
export default function AtualizacaoTempoReal({
  contexto,
}: PropriedadesAtualizacaoTempoReal) {
  const router = useRouter();
  const rota = `${contexto.prefixoRotas}${ROTA_EVENTOS}`;

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return;
    }
    const fonte = new EventSource(rota);
    let ultimaRevisao: string | null = null;
    let pendente = false;
    let temporizador: number | undefined;

    function recarregar(): void {
      temporizador = undefined;
      if (document.visibilityState !== 'visible') {
        pendente = true;
        return;
      }
      pendente = false;
      router.refresh();
    }

    function agendar(): void {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(recarregar, ESPERA_AGRUPAMENTO_MS);
    }

    // A primeira revisão só marca o ponto de partida. Depois, qualquer
    // diferença (inclusive a revisão zerada por um reinício do servidor)
    // significa que algo mudou.
    function aoAlterar(evento: MessageEvent<string>): void {
      const anterior = ultimaRevisao;
      ultimaRevisao = evento.data;
      if (anterior !== null && anterior !== evento.data) {
        agendar();
      }
    }

    function aoVoltar(): void {
      if (pendente && document.visibilityState === 'visible') {
        agendar();
      }
    }

    fonte.addEventListener(EVENTO_ALTERACAO, aoAlterar);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      fonte.close();
      window.clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [rota, router]);

  return null;
}
