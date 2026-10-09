'use client';

import { useId, useRef, useState } from 'react';
import Icone from '@/components/ui/Icone';

type PropriedadesBlocoCodigoCopiavel = {
  rotulo: string;
  codigo: string;
  rotuloCopiar: string;
  avisoCopiado: string;
  avisoSelecionado: string;
};

// Como no CampoCopiavel: sem contexto seguro (http://IP da rede local) não há
// área de transferência, então o código fica selecionado para Ctrl+C.
export default function BlocoCodigoCopiavel({
  rotulo,
  codigo,
  rotuloCopiar,
  avisoCopiado,
  avisoSelecionado,
}: PropriedadesBlocoCodigoCopiavel) {
  const codigoRef = useRef<HTMLPreElement>(null);
  const [aviso, setAviso] = useState('');
  const idRotulo = useId();

  function selecionar(): void {
    const elemento = codigoRef.current;
    const selecao = window.getSelection();
    if (elemento && selecao) {
      const intervalo = document.createRange();
      intervalo.selectNodeContents(elemento);
      selecao.removeAllRanges();
      selecao.addRange(intervalo);
    }
    setAviso(avisoSelecionado);
  }

  async function copiar(): Promise<void> {
    if (!navigator.clipboard) {
      selecionar();
      return;
    }
    try {
      await navigator.clipboard.writeText(codigo);
      setAviso(avisoCopiado);
    } catch {
      selecionar();
    }
  }

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption
        id={idRotulo}
        className="flex items-center justify-between gap-2 text-sm font-medium"
      >
        {rotulo}
        <button
          type="button"
          onClick={() => void copiar()}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-primaria hover:bg-primaria-suave focus-visible:outline-2 focus-visible:outline-primaria"
        >
          <Icone nome="copiar" className="size-3.5" />
          {rotuloCopiar}
        </button>
      </figcaption>
      <pre
        ref={codigoRef}
        aria-labelledby={idRotulo}
        className="rolagem-fina overflow-x-auto rounded-xl border border-borda bg-[#1d2a1c] p-3 font-mono text-xs leading-relaxed text-[#e4ebe1]"
      >
        {codigo}
      </pre>
      <p role="status" className="text-xs text-texto-suave">
        {aviso}
      </p>
    </figure>
  );
}
