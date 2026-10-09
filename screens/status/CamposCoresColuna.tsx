'use client';

import { useState, type CSSProperties } from 'react';
import CampoCorOpcional from '@/components/ui/CampoCorOpcional';
import {
  CORES_SUGERIDAS_SUPERFICIE,
  type SuperficiesBoard,
} from '@/config/aparenciaBoard';
import { CAMPOS_STATUS } from '@/config/camposFormulario';
import { textosStatus } from '@/screens/status/textosStatus';
import {
  calcularAparenciaColuna,
  montarVariaveisColuna,
} from '@/util/AparenciaUtils';

export type AparenciaPadraoColunas = {
  superficies: SuperficiesBoard;
  amostrasFundo: readonly string[];
};

type PropriedadesCamposCoresColuna = {
  nomeColuna: string;
  corTitulo: string | null;
  corColuna: string | null;
  aparenciaPadrao: AparenciaPadraoColunas;
  erros?: Partial<Record<string, string[]>>;
};

// Cores próprias da coluna, com prévia do título e do corpo sobre o fundo do
// board (mesmo cálculo de contraste do quadro).
export default function CamposCoresColuna({
  nomeColuna,
  corTitulo,
  corColuna,
  aparenciaPadrao,
  erros,
}: PropriedadesCamposCoresColuna) {
  const [cores, setCores] = useState({ corTitulo, corColuna });
  const { superficies, amostrasFundo } = aparenciaPadrao;
  const aparencia = calcularAparenciaColuna(amostrasFundo, superficies, cores);
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-borda p-3">
      <legend className="px-1 text-sm font-medium">
        {textosStatus.legendaCores}
      </legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_10rem]">
        <CampoCorOpcional
          nome={CAMPOS_STATUS.COR_TITULO}
          rotulo={textosStatus.rotuloCorTitulo}
          rotuloPadrao={textosStatus.usarCorPadrao}
          valorInicial={corTitulo}
          corPadrao={superficies.corTitulos}
          sugestoes={CORES_SUGERIDAS_SUPERFICIE}
          erros={erros?.[CAMPOS_STATUS.COR_TITULO]}
          aoAlterar={(cor) =>
            setCores((atuais) => ({ ...atuais, corTitulo: cor }))
          }
        />
        <CampoCorOpcional
          nome={CAMPOS_STATUS.COR_COLUNA}
          rotulo={textosStatus.rotuloCorColuna}
          rotuloPadrao={textosStatus.usarCorPadrao}
          valorInicial={corColuna}
          corPadrao={superficies.corColunas}
          sugestoes={CORES_SUGERIDAS_SUPERFICIE}
          erros={erros?.[CAMPOS_STATUS.COR_COLUNA]}
          aoAlterar={(cor) =>
            setCores((atuais) => ({ ...atuais, corColuna: cor }))
          }
        />
        <div
          aria-hidden="true"
          data-tom={aparencia.coluna.tom}
          style={montarVariaveisColuna(aparencia) as CSSProperties}
          className="superficie-coluna contorno-superficie flex h-fit flex-col gap-2 self-start rounded-xl border p-1.5"
        >
          <span
            data-tom={aparencia.titulo.tom}
            className="superficie-titulo truncate rounded-lg px-2 py-1 text-xs font-semibold"
          >
            {nomeColuna || textosStatus.previaNome}
          </span>
          <span className="h-6 rounded-md bg-superficie shadow-cartao" />
        </div>
      </div>
      <p className="text-xs text-texto-suave">{textosStatus.dicaCores}</p>
    </fieldset>
  );
}
