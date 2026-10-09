'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { textosAtividades } from '@/screens/atividades/textosAtividades';

// Quem está dentro do modal (a edição) pode segurar o fechamento para
// confirmar o descarte de alterações: devolve true quando assumiu, e chama
// `fechar` se a pessoa confirmar.
export type GuardaFechamento = (fechar: () => void) => boolean;

export type ControleFechamentoModal = {
  definirGuarda: (guarda: GuardaFechamento | null) => void;
};

export const ContextoFechamentoModal =
  createContext<ControleFechamentoModal | null>(null);

type PropriedadesModalRotaAtividade = {
  idTitulo: string;
  // Variáveis de aparência do board: o diálogo é renderizado fora da
  // EstruturaPainel e precisaria delas para seguir as cores configuradas.
  estilo: CSSProperties;
  children: ReactNode;
};

function clicouForaDaCaixa(evento: MouseEvent<HTMLDialogElement>): boolean {
  if (evento.target !== evento.currentTarget) {
    return false;
  }
  const caixa = evento.currentTarget.getBoundingClientRect();
  return (
    evento.clientX < caixa.left ||
    evento.clientX > caixa.right ||
    evento.clientY < caixa.top ||
    evento.clientY > caixa.bottom
  );
}

// Detalhe da atividade aberto por cima do quadro (rota interceptada). Fechar
// volta no histórico, então o quadro reaparece onde estava; abrir o endereço
// direto (ou recarregar) continua mostrando a página completa.
export default function ModalRotaAtividade({
  idTitulo,
  estilo,
  children,
}: PropriedadesModalRotaAtividade) {
  const router = useRouter();
  const referencia = useRef<HTMLDialogElement>(null);
  const fechandoRef = useRef(false);
  const guardaRef = useRef<GuardaFechamento | null>(null);
  const pressionouFundoRef = useRef(false);
  const controle = useMemo<ControleFechamentoModal>(
    () => ({
      definirGuarda: (guarda) => {
        guardaRef.current = guarda;
      },
    }),
    [],
  );

  useEffect(() => {
    const dialogo = referencia.current;
    if (dialogo && !dialogo.open) {
      dialogo.showModal();
    }
  }, []);

  // Fechar é voltar no histórico: a rota sai e o diálogo desmonta junto. Não
  // depende do evento `close`, que o Chromium só entrega no próximo quadro
  // de animação (e a trava evita voltar duas vezes).
  function fechar(): void {
    if (fechandoRef.current) {
      return;
    }
    fechandoRef.current = true;
    router.back();
  }

  function solicitarFechamento(): void {
    if (guardaRef.current?.(fechar)) {
      return;
    }
    fechar();
  }

  function cancelar(evento: SyntheticEvent<HTMLDialogElement>): void {
    evento.preventDefault();
    solicitarFechamento();
  }

  // Clique no fundo escurecido fecha, como o Esc. Vale só se o clique também
  // começou no fundo: arrastar uma seleção de texto para fora da caixa (ou
  // usar a barra de rolagem dela) não fecha.
  function pressionar(evento: PointerEvent<HTMLDialogElement>): void {
    pressionouFundoRef.current = clicouForaDaCaixa(evento);
  }

  function clicar(evento: MouseEvent<HTMLDialogElement>): void {
    if (pressionouFundoRef.current && clicouForaDaCaixa(evento)) {
      solicitarFechamento();
    }
    pressionouFundoRef.current = false;
  }

  return (
    <dialog
      ref={referencia}
      aria-labelledby={idTitulo}
      onCancel={cancelar}
      onClose={fechar}
      onPointerDown={pressionar}
      onClick={clicar}
      style={estilo}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(56rem,calc(100vw-2rem))] rounded-2xl border border-borda bg-superficie p-0 text-texto shadow-flutuante backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-2 p-4 sm:p-6">
        <div className="-mt-1 -mr-1 flex justify-end sm:-mt-3 sm:-mr-3">
          <button
            type="button"
            onClick={solicitarFechamento}
            aria-label={textosAtividades.fecharDetalhe}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-xl text-texto-suave hover:bg-fundo focus-visible:outline-2 focus-visible:outline-primaria"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <ContextoFechamentoModal.Provider value={controle}>
          {children}
        </ContextoFechamentoModal.Provider>
      </div>
    </dialog>
  );
}
