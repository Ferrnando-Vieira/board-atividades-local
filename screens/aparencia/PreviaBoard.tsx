import type { CSSProperties } from 'react';
import type { CoresPrioridade } from '@/config/aparenciaBoard';
import IndicadorPrioridade from '@/screens/atividades/IndicadorPrioridade';
import { textosAparencia as textos } from '@/screens/aparencia/textosAparencia';
import { combinarClasses } from '@/util/ClassesUtils';
import {
  montarVariaveisColuna,
  montarVariaveisPrioridade,
  type AparenciaColuna,
} from '@/util/AparenciaUtils';

const PRIORIDADE_EXEMPLO_DESTAQUE = 0;
const PRIORIDADE_EXEMPLO_COMUM = 5;

type PropriedadesPreviaBoard = {
  estiloFundo: CSSProperties | undefined;
  aparencia: AparenciaColuna;
  // Sem cores, valem as do painel (variáveis herdadas do layout).
  coresPrioridade?: CoresPrioridade;
  className?: string;
};

// Miniatura do board com as mesmas classes e variáveis usadas nas colunas
// reais: o que a prévia mostra é o que o board vai mostrar.
export default function PreviaBoard({
  estiloFundo,
  aparencia,
  coresPrioridade,
  className,
}: PropriedadesPreviaBoard) {
  const variaveis = {
    ...montarVariaveisColuna(aparencia),
    ...(coresPrioridade ? montarVariaveisPrioridade(coresPrioridade) : {}),
  } as CSSProperties;
  return (
    <div
      role="img"
      aria-label={textos.rotuloPrevia}
      className={combinarClasses(
        'relative flex min-h-60 items-start justify-center overflow-hidden rounded-2xl border border-borda bg-fundo p-4 shadow-inner',
        className,
      )}
      style={{ ...estiloFundo, ...variaveis }}
    >
      <div
        data-tom={aparencia.coluna.tom}
        className="superficie-coluna contorno-superficie flex w-full max-w-60 flex-col gap-2 rounded-2xl border p-2 shadow-cartao"
      >
        <div
          data-tom={aparencia.titulo.tom}
          className="superficie-titulo flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          <span>{textos.previaColuna}</span>
          <span className="rounded-full bg-current/10 px-2 text-xs tabular-nums">
            3
          </span>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-borda/70 border-l-[3px] border-l-(--cor-prioridade-critica) bg-superficie p-2.5 text-xs text-texto shadow-cartao">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium">{textos.previaCartaoUrgente}</span>
            <IndicadorPrioridade prioridade={PRIORIDADE_EXEMPLO_DESTAQUE} />
          </div>
          <span className="w-fit rounded-full border border-borda bg-fundo px-2 py-0.5 text-texto-suave">
            {textos.previaTag}
          </span>
        </div>
        <div className="flex items-start justify-between gap-2 rounded-xl border border-borda/70 border-l-[3px] border-l-(--cor-prioridade-media) bg-superficie p-2.5 text-xs text-texto shadow-cartao">
          <span className="font-medium">{textos.previaCartaoComum}</span>
          <IndicadorPrioridade prioridade={PRIORIDADE_EXEMPLO_COMUM} />
        </div>
        <p className="texto-superficie-suave px-2 pb-1 text-xs">
          {textos.previaRodape}
        </p>
      </div>
    </div>
  );
}
