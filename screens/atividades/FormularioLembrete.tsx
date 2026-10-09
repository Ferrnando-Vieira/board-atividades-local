'use client';

import { useActionState, useId } from 'react';
import Botao from '@/components/ui/Botao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_LEMBRETE } from '@/config/camposFormulario';
import CamposDataHora from '@/screens/aplicacao/CamposDataHora';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { salvarLembreteFormulario } from '@/servidor/web/acoes/acoesLembretes';
import {
  ESTADO_FORMULARIO_GESTAO_INICIAL,
  type EstadoFormularioGestao,
} from '@/types/formulario';
import type { MomentoLocal } from '@/util/DataUtils';
import { lerValorTexto } from '@/util/FormularioUtils';
import { HORAS_SUGESTAO_FUTURA } from '@/util/SugestaoDataHoraUtils';

type PropriedadesFormularioLembrete = {
  atividadeId: number;
  versao: number;
  lembreteLocal: MomentoLocal | null;
  dataMinima: string;
  fusoHorario: string;
};

function lerValorInicial(
  estado: EstadoFormularioGestao,
  campo: string,
  padrao: string,
): string {
  return lerValorTexto(estado.valores, campo) ?? padrao;
}

// Os campos são remontados a cada resposta (`tentativa`) com o que foi
// enviado, porque o React 19 reinicia formulários não controlados. A data
// mínima só ajuda a escolher; quem recusa o passado é o servidor.
export default function FormularioLembrete({
  atividadeId,
  versao,
  lembreteLocal,
  dataMinima,
  fusoHorario,
}: PropriedadesFormularioLembrete) {
  const [estado, acao, pendente] = useActionState(
    salvarLembreteFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const idData = useId();
  const idHora = useId();
  return (
    <form key={estado.tentativa} action={acao} className="flex flex-col gap-3">
      <input
        type="hidden"
        name={CAMPOS_LEMBRETE.ATIVIDADE_ID}
        value={atividadeId}
      />
      <input type="hidden" name={CAMPOS_LEMBRETE.VERSAO} value={versao} />
      <CamposDataHora
        idData={idData}
        idHora={idHora}
        nomeData={CAMPOS_LEMBRETE.DATA}
        nomeHora={CAMPOS_LEMBRETE.HORA}
        rotuloData={textosAtividades.rotuloDataLembrete}
        rotuloHora={textosAtividades.rotuloHoraLembrete}
        valorData={lerValorInicial(
          estado,
          CAMPOS_LEMBRETE.DATA,
          lembreteLocal?.data ?? '',
        )}
        valorHora={lerValorInicial(
          estado,
          CAMPOS_LEMBRETE.HORA,
          lembreteLocal?.hora ?? '',
        )}
        errosData={estado.errosCampos?.[CAMPOS_LEMBRETE.DATA]}
        errosHora={estado.errosCampos?.[CAMPOS_LEMBRETE.HORA]}
        horasAFrente={HORAS_SUGESTAO_FUTURA}
        fusoHorario={fusoHorario}
        obrigatorio
        dataMinima={dataMinima}
        classesGrade="grid grid-cols-1 gap-3 sm:grid-cols-2"
      />
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div>
        <Botao type="submit" disabled={pendente}>
          {pendente
            ? textosAtividades.botaoSalvando
            : lembreteLocal
              ? textosAtividades.botaoRemarcarLembrete
              : textosAtividades.botaoSalvarLembrete}
        </Botao>
      </div>
    </form>
  );
}
