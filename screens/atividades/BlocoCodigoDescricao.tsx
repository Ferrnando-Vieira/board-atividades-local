'use client';

import { useRef, useState, type ReactNode } from 'react';
import Icone from '@/components/ui/Icone';
import { textosAtividades } from '@/screens/atividades/textosAtividades';

type PropriedadesBlocoCodigoDescricao = {
  children: ReactNode;
};

// Como no BlocoCodigoCopiavel: sem contexto seguro (http://IP da rede local)
// não há área de transferência, então o código fica selecionado para o Ctrl+C.
export default function BlocoCodigoDescricao({
  children,
}: PropriedadesBlocoCodigoDescricao) {
  const codigoRef = useRef<HTMLPreElement>(null);
  const [aviso, setAviso] = useState('');

  function selecionar(): void {
    const elemento = codigoRef.current;
    const selecao = window.getSelection();
    if (elemento && selecao) {
      const intervalo = document.createRange();
      intervalo.selectNodeContents(elemento);
      selecao.removeAllRanges();
      selecao.addRange(intervalo);
    }
    setAviso(textosAtividades.codigoSelecionado);
  }

  async function copiar(): Promise<void> {
    const codigo = codigoRef.current?.textContent ?? '';
    if (!navigator.clipboard) {
      selecionar();
      return;
    }
    try {
      await navigator.clipboard.writeText(codigo);
      setAviso(textosAtividades.codigoCopiado);
    } catch {
      selecionar();
    }
  }

  return (
    <div className="bloco-codigo-descricao">
      <button
        type="button"
        onClick={() => void copiar()}
        aria-label={textosAtividades.rotuloCopiarCodigo}
        className="absolute top-1.5 right-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-[#1d2a1c]/80 px-2 text-xs font-semibold text-[#e4ebe1] hover:bg-[#2c3d2a] focus-visible:outline-2 focus-visible:outline-primaria"
      >
        <Icone nome="copiar" className="size-3.5" />
        {textosAtividades.copiarCodigo}
      </button>
      <pre ref={codigoRef}>{children}</pre>
      <p role="status" className="sr-only">
        {aviso}
      </p>
    </div>
  );
}
