'use client';

import { useId } from 'react';
import Icone from '@/components/ui/Icone';
import type { CorNomeada } from '@/config/aparenciaBoard';
import { combinarClasses } from '@/util/ClassesUtils';
import { corTextoSobre } from '@/util/CorUtils';

type PropriedadesCampoCor = {
  nome: string;
  rotulo: string;
  valor: string;
  aoAlterar: (cor: string) => void;
  sugestoes?: readonly CorNomeada[];
  erros?: string[];
  desabilitado?: boolean;
  dica?: string;
  // Para quando um título visível logo acima já nomeia o campo: o rótulo
  // continua existindo para leitores de tela, sem repetir o texto na tela.
  ocultarRotulo?: boolean;
};

const ROTULO_ESCOLHER = 'Escolher a cor';

export default function CampoCor({
  nome,
  rotulo,
  valor,
  aoAlterar,
  sugestoes = [],
  erros,
  desabilitado = false,
  dica,
  ocultarRotulo = false,
}: PropriedadesCampoCor) {
  const id = useId();
  const idErro = useId();
  const idDica = useId();
  const possuiErro = Boolean(erros?.length);
  const descricoes = [possuiErro && idErro, dica && idDica]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={ocultarRotulo ? 'sr-only' : 'text-sm font-medium'}
      >
        {rotulo}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="color"
          name={nome}
          value={valor}
          disabled={desabilitado}
          onChange={(evento) => aoAlterar(evento.target.value)}
          aria-invalid={possuiErro}
          aria-describedby={descricoes || undefined}
          title={ROTULO_ESCOLHER}
          className="h-10 w-14 cursor-pointer rounded-xl border border-borda bg-superficie p-1 focus-visible:outline-2 focus-visible:outline-primaria disabled:cursor-not-allowed"
        />
        <span className="font-mono text-xs text-texto-suave">{valor}</span>
        {sugestoes.length > 0 && (
          <ul
            className="flex flex-wrap gap-1.5"
            aria-label={`${rotulo}: sugestões`}
          >
            {sugestoes.map((sugestao) => {
              const selecionada = sugestao.cor === valor;
              return (
                <li key={sugestao.cor}>
                  <button
                    type="button"
                    disabled={desabilitado}
                    aria-label={sugestao.nome}
                    aria-pressed={selecionada}
                    title={sugestao.nome}
                    onClick={() => aoAlterar(sugestao.cor)}
                    style={{
                      backgroundColor: sugestao.cor,
                      color: corTextoSobre(sugestao.cor),
                    }}
                    className={combinarClasses(
                      'grid size-7 place-items-center rounded-full border border-texto/15 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
                      selecionada && 'ring-2 ring-primaria ring-offset-2',
                    )}
                  >
                    {selecionada && <Icone nome="check" className="size-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {dica && (
        <p id={idDica} className="text-xs text-texto-suave">
          {dica}
        </p>
      )}
      {possuiErro && (
        <p id={idErro} className="text-xs text-erro">
          {erros?.join(' ')}
        </p>
      )}
    </div>
  );
}
