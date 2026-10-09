'use client';

import { useActionState, useEffect, useId } from 'react';
import Botao from '@/components/ui/Botao';
import CampoAreaTexto from '@/components/ui/CampoAreaTexto';
import CampoFormulario from '@/components/ui/CampoFormulario';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_LEMBRETE_AVULSO } from '@/config/camposFormulario';
import { LIMITES_TEXTO } from '@/config/constantes';
import CamposDataHora from '@/screens/aplicacao/CamposDataHora';
import { textosLembretes as textos } from '@/screens/lembretes/textosLembretes';
import {
  criarLembreteAvulsoFormulario,
  editarLembreteAvulsoFormulario,
} from '@/servidor/web/acoes/acoesLembretes';
import {
  ESTADO_FORMULARIO_GESTAO_INICIAL,
  type EstadoFormularioGestao,
} from '@/types/formulario';
import { combinarClasses } from '@/util/ClassesUtils';
import { lerValorTexto } from '@/util/FormularioUtils';
import { HORAS_SUGESTAO_FUTURA } from '@/util/SugestaoDataHoraUtils';

export type LembreteAvulsoEditavel = {
  id: number;
  versao: number;
  titulo: string;
  observacao: string | null;
  data: string;
  hora: string;
};

type PropriedadesFormularioLembreteAvulso = {
  dataMinima: string;
  // Fuso do board para a sugestão de data e hora; na central do cabeçalho,
  // que não o conhece, vale o do navegador.
  fusoHorario?: string;
  // Sem lembrete, o formulário cria um novo.
  lembrete?: LembreteAvulsoEditavel;
  // Versão enxuta (central do cabeçalho): campos em coluna, sem observação.
  compacto?: boolean;
  aoSalvar?: () => void;
};

function lerValorInicial(
  estado: EstadoFormularioGestao,
  campo: string,
  padrao: string,
): string {
  return lerValorTexto(estado.valores, campo) ?? padrao;
}

// Os campos são remontados a cada resposta (`tentativa`) com o que foi
// enviado. A data mínima só ajuda a escolher; quem recusa o passado é o
// servidor, no fuso do board.
export default function FormularioLembreteAvulso({
  dataMinima,
  fusoHorario,
  lembrete,
  compacto = false,
  aoSalvar,
}: PropriedadesFormularioLembreteAvulso) {
  const [estado, acao, pendente] = useActionState(
    lembrete ? editarLembreteAvulsoFormulario : criarLembreteAvulsoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const prefixo = useId();

  useEffect(() => {
    if (estado.mensagemSucesso) {
      aoSalvar?.();
    }
  }, [estado.tentativa, estado.mensagemSucesso, aoSalvar]);

  const rotuloBotao = lembrete
    ? pendente
      ? textos.botaoSalvando
      : textos.botaoSalvar
    : pendente
      ? textos.botaoCriando
      : textos.botaoCriar;
  return (
    <form key={estado.tentativa} action={acao} className="flex flex-col gap-3">
      {lembrete && (
        <>
          <input
            type="hidden"
            name={CAMPOS_LEMBRETE_AVULSO.LEMBRETE_ID}
            value={lembrete.id}
          />
          <input
            type="hidden"
            name={CAMPOS_LEMBRETE_AVULSO.VERSAO}
            value={lembrete.versao}
          />
        </>
      )}
      <CampoFormulario
        id={`${prefixo}-titulo`}
        name={CAMPOS_LEMBRETE_AVULSO.TITULO}
        rotulo={textos.rotuloTitulo}
        placeholder={textos.placeholderTitulo}
        maxLength={LIMITES_TEXTO.TITULO_LEMBRETE}
        autoComplete="off"
        required
        defaultValue={lerValorInicial(
          estado,
          CAMPOS_LEMBRETE_AVULSO.TITULO,
          lembrete?.titulo ?? '',
        )}
        erros={estado.errosCampos?.[CAMPOS_LEMBRETE_AVULSO.TITULO]}
      />
      <CamposDataHora
        idData={`${prefixo}-data`}
        idHora={`${prefixo}-hora`}
        nomeData={CAMPOS_LEMBRETE_AVULSO.DATA}
        nomeHora={CAMPOS_LEMBRETE_AVULSO.HORA}
        rotuloData={textos.rotuloData}
        rotuloHora={textos.rotuloHora}
        valorData={lerValorInicial(
          estado,
          CAMPOS_LEMBRETE_AVULSO.DATA,
          lembrete?.data ?? '',
        )}
        valorHora={lerValorInicial(
          estado,
          CAMPOS_LEMBRETE_AVULSO.HORA,
          lembrete?.hora ?? '',
        )}
        errosData={estado.errosCampos?.[CAMPOS_LEMBRETE_AVULSO.DATA]}
        errosHora={estado.errosCampos?.[CAMPOS_LEMBRETE_AVULSO.HORA]}
        horasAFrente={HORAS_SUGESTAO_FUTURA}
        fusoHorario={fusoHorario}
        obrigatorio
        dataMinima={dataMinima}
        classesGrade={combinarClasses(
          'grid gap-3',
          compacto ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2',
        )}
      />
      {!compacto && (
        <CampoAreaTexto
          id={`${prefixo}-observacao`}
          name={CAMPOS_LEMBRETE_AVULSO.OBSERVACAO}
          rotulo={textos.rotuloObservacao}
          maxLength={LIMITES_TEXTO.OBSERVACAO_LEMBRETE}
          rows={2}
          defaultValue={lerValorInicial(
            estado,
            CAMPOS_LEMBRETE_AVULSO.OBSERVACAO,
            lembrete?.observacao ?? '',
          )}
          erros={estado.errosCampos?.[CAMPOS_LEMBRETE_AVULSO.OBSERVACAO]}
        />
      )}
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div>
        <Botao type="submit" disabled={pendente}>
          {rotuloBotao}
        </Botao>
      </div>
    </form>
  );
}
