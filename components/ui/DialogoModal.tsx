'use client';

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type SyntheticEvent,
} from 'react';

type PropriedadesDialogoModal = {
  aberto: boolean;
  titulo: string;
  rotuloFechar: string;
  aoFechar: () => void;
  // Quando informado, Esc e o botão de fechar só pedem o fechamento: quem
  // abriu decide (por exemplo, confirmar antes de descartar um rascunho).
  aoSolicitarFechamento?: () => void;
  children: ReactNode;
};

// Mesmo recurso do DialogoConfirmacao (`showModal`: foco preso, fundo inerte
// e Esc), para conteúdos maiores que rolam dentro do próprio diálogo.
export default function DialogoModal({
  aberto,
  titulo,
  rotuloFechar,
  aoFechar,
  aoSolicitarFechamento,
  children,
}: PropriedadesDialogoModal) {
  const referencia = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const dialogo = referencia.current;
    if (!dialogo) {
      return;
    }
    if (aberto && !dialogo.open) {
      dialogo.showModal();
    }
    if (!aberto && dialogo.open) {
      dialogo.close();
    }
  }, [aberto]);

  function cancelar(evento: SyntheticEvent<HTMLDialogElement>): void {
    if (aoSolicitarFechamento) {
      evento.preventDefault();
      aoSolicitarFechamento();
    }
  }

  return (
    <dialog
      ref={referencia}
      aria-labelledby={idTitulo}
      onCancel={cancelar}
      onClose={aoFechar}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100vw-2rem))] rounded-xl border border-borda bg-superficie p-0 text-texto shadow-lg backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <header className="flex items-start justify-between gap-3">
          <h2 id={idTitulo} className="text-lg font-semibold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={aoSolicitarFechamento ?? aoFechar}
            aria-label={rotuloFechar}
            className="-m-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-xl text-texto-suave hover:bg-fundo focus-visible:outline-2 focus-visible:outline-primaria"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
