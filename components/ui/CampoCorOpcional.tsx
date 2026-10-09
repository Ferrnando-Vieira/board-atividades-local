'use client';

import { useId, useState } from 'react';
import CampoCor from '@/components/ui/CampoCor';
import type { CorNomeada } from '@/config/aparenciaBoard';

type PropriedadesCampoCorOpcional = {
  nome: string;
  rotulo: string;
  rotuloPadrao: string;
  valorInicial: string | null;
  // Cor mostrada no seletor enquanto vale o padrão (e ponto de partida ao
  // desmarcar a caixa).
  corPadrao: string;
  sugestoes?: readonly CorNomeada[];
  erros?: string[];
  aoAlterar?: (cor: string | null) => void;
};

// Com "usar o padrão" marcado o seletor fica desabilitado, e campo
// desabilitado não vai no envio: o servidor recebe vazio e grava nulo.
export default function CampoCorOpcional({
  nome,
  rotulo,
  rotuloPadrao,
  valorInicial,
  corPadrao,
  sugestoes,
  erros,
  aoAlterar,
}: PropriedadesCampoCorOpcional) {
  const [usarPadrao, setUsarPadrao] = useState(valorInicial === null);
  const [cor, setCor] = useState(valorInicial ?? corPadrao);
  const idPadrao = useId();

  function alternarPadrao(marcado: boolean): void {
    setUsarPadrao(marcado);
    aoAlterar?.(marcado ? null : cor);
  }

  function alterarCor(novaCor: string): void {
    setCor(novaCor);
    aoAlterar?.(novaCor);
  }

  return (
    <div className="flex flex-col gap-2">
      <CampoCor
        nome={nome}
        rotulo={rotulo}
        valor={usarPadrao ? corPadrao : cor}
        sugestoes={sugestoes}
        erros={erros}
        desabilitado={usarPadrao}
        aoAlterar={alterarCor}
      />
      <div className="flex items-center gap-2">
        <input
          id={idPadrao}
          type="checkbox"
          checked={usarPadrao}
          onChange={(evento) => alternarPadrao(evento.target.checked)}
          className="size-4 accent-primaria"
        />
        <label htmlFor={idPadrao} className="text-sm text-texto-suave">
          {rotuloPadrao}
        </label>
      </div>
    </div>
  );
}
