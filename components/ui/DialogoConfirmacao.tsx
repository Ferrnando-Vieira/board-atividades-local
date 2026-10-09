'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import Botao from '@/components/ui/Botao';

type PropriedadesDialogoConfirmacao = {
  aberto: boolean;
  titulo: string;
  children: ReactNode;
  rotuloConfirmar: string;
  rotuloConfirmando: string;
  rotuloCancelar: string;
  pendente: boolean;
  aoCancelar: () => void;
};

// Fica dentro do formulário da ação: o botão de confirmação é o próprio envio,
// então nada é executado sem o clique explícito. `showModal` dá foco preso,
// fundo inerte e Esc para cancelar, sem biblioteca externa.
export default function DialogoConfirmacao({
  aberto,
  titulo,
  children,
  rotuloConfirmar,
  rotuloConfirmando,
  rotuloCancelar,
  pendente,
  aoCancelar,
}: PropriedadesDialogoConfirmacao) {
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

  return (
    <dialog
      ref={referencia}
      aria-labelledby={idTitulo}
      onClose={aoCancelar}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-borda bg-superficie p-0 text-texto shadow-lg backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id={idTitulo} className="text-lg font-semibold">
          {titulo}
        </h2>
        <div className="flex flex-col gap-3 text-sm">{children}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoCancelar} disabled={pendente}>
            {rotuloCancelar}
          </Botao>
          <Botao type="submit" variante="perigo" disabled={pendente}>
            {pendente ? rotuloConfirmando : rotuloConfirmar}
          </Botao>
        </div>
      </div>
    </dialog>
  );
}
