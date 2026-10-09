'use client';

import { useActionState, useState, type CSSProperties } from 'react';
import Botao from '@/components/ui/Botao';
import CampoCor from '@/components/ui/CampoCor';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import {
  CORES_PRIORIDADE_PADRAO,
  CORES_SUGERIDAS_PRIORIDADE,
  NIVEIS_PRIORIDADE,
  type CoresPrioridade,
} from '@/config/aparenciaBoard';
import { CAMPOS_PRIORIDADES } from '@/config/camposFormulario';
import IndicadorPrioridade from '@/screens/atividades/IndicadorPrioridade';
import { textosAparencia as textos } from '@/screens/aparencia/textosAparencia';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { salvarCoresPrioridadeFormulario } from '@/servidor/web/acoes/acoesFundo';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { montarVariaveisPrioridade } from '@/util/AparenciaUtils';
import type { NivelPrioridade } from '@/util/PrioridadeUtils';

// Uma prioridade representativa de cada nível, para a prévia dos selos.
const PRIORIDADE_DO_NIVEL: Record<NivelPrioridade, number> = {
  critica: 0,
  alta: 2,
  media: 5,
  baixa: 8,
};

type PropriedadesFormularioPrioridades = {
  // Link nomeado editando a própria aparência; nula no painel do proprietário.
  credencial: string | null;
  coresAtuais: CoresPrioridade;
};

export default function FormularioPrioridades({
  credencial,
  coresAtuais,
}: PropriedadesFormularioPrioridades) {
  const [estado, acao, pendente] = useActionState(
    salvarCoresPrioridadeFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [cores, setCores] = useState<CoresPrioridade>(coresAtuais);
  const erros = estado.errosCampos ?? {};
  const variaveis = montarVariaveisPrioridade(cores) as CSSProperties;

  return (
    <form action={acao} className="flex flex-col gap-5" style={variaveis}>
      <CampoCredencial credencial={credencial} />
      <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {NIVEIS_PRIORIDADE.map((nivel) => (
          <li
            key={nivel}
            className="flex flex-col gap-3 rounded-xl border border-borda p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
                {textos.niveisPrioridade[nivel]}
              </span>
              <span className="flex items-center gap-2">
                <IndicadorPrioridade prioridade={PRIORIDADE_DO_NIVEL[nivel]} />
                <span
                  aria-hidden="true"
                  className="h-6 w-1 rounded-full"
                  style={{ backgroundColor: cores[nivel] }}
                />
              </span>
            </div>
            <CampoCor
              nome={CAMPOS_PRIORIDADES[nivel]}
              rotulo={textos.niveisPrioridade[nivel]}
              ocultarRotulo
              valor={cores[nivel]}
              sugestoes={CORES_SUGERIDAS_PRIORIDADE}
              erros={erros[CAMPOS_PRIORIDADES[nivel]]}
              aoAlterar={(cor) =>
                setCores((atuais) => ({ ...atuais, [nivel]: cor }))
              }
            />
          </li>
        ))}
      </ul>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente}>
          {pendente ? textos.botaoSalvando : textos.botaoAplicarPrioridades}
        </Botao>
        <Botao
          variante="fantasma"
          onClick={() => setCores(CORES_PRIORIDADE_PADRAO)}
        >
          {textos.botaoRestaurarPadrao}
        </Botao>
      </div>
    </form>
  );
}
