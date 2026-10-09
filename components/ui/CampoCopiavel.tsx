'use client';

import { useRef, useState } from 'react';
import Botao from '@/components/ui/Botao';
import { CLASSES_CONTROLE } from '@/components/ui/EstruturaCampo';
import { combinarClasses } from '@/util/ClassesUtils';

type SituacaoCopia = 'inicial' | 'copiado' | 'selecionado';

type PropriedadesCampoCopiavel = {
  id: string;
  rotulo: string;
  valor: string;
  rotuloCopiar: string;
  avisoCopiado: string;
  avisoSelecionado: string;
};

// A API de área de transferência só existe em contexto seguro (HTTPS ou
// localhost). Acessando pelo IP da rede local sem HTTPS, o texto fica
// selecionado para a pessoa copiar com o atalho do sistema.
export default function CampoCopiavel({
  id,
  rotulo,
  valor,
  rotuloCopiar,
  avisoCopiado,
  avisoSelecionado,
}: PropriedadesCampoCopiavel) {
  const campoRef = useRef<HTMLInputElement>(null);
  const [situacao, setSituacao] = useState<SituacaoCopia>('inicial');

  function selecionar(): void {
    campoRef.current?.focus();
    campoRef.current?.select();
    setSituacao('selecionado');
  }

  async function copiar(): Promise<void> {
    if (!navigator.clipboard) {
      selecionar();
      return;
    }
    try {
      await navigator.clipboard.writeText(valor);
      setSituacao('copiado');
    } catch {
      selecionar();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          ref={campoRef}
          value={valor}
          readOnly
          onFocus={(evento) => evento.currentTarget.select()}
          className={combinarClasses(
            CLASSES_CONTROLE,
            'min-h-11 flex-1 border-borda font-mono text-sm',
          )}
        />
        <Botao variante="secundario" onClick={() => void copiar()}>
          {rotuloCopiar}
        </Botao>
      </div>
      <p role="status" className="text-xs text-texto-suave">
        {situacao === 'copiado' && avisoCopiado}
        {situacao === 'selecionado' && avisoSelecionado}
      </p>
    </div>
  );
}
