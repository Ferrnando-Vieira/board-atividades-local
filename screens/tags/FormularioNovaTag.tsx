'use client';

import { useActionState } from 'react';
import Botao from '@/components/ui/Botao';
import CampoCorOpcional from '@/components/ui/CampoCorOpcional';
import CampoFormulario from '@/components/ui/CampoFormulario';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_TAG } from '@/config/camposFormulario';
import { LIMITES_TEXTO } from '@/config/constantes';
import { COR_TAG_NEUTRA, CORES_SUGERIDAS_TAG } from '@/config/coresTags';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { textosTags } from '@/screens/tags/textosTags';
import { criarTagFormulario } from '@/servidor/web/acoes/acoesTags';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { lerValorTexto } from '@/util/FormularioUtils';

type PropriedadesFormularioNovaTag = {
  credencial: string | null;
  idListaSolicitantes: string;
};

export default function FormularioNovaTag({
  credencial,
  idListaSolicitantes,
}: PropriedadesFormularioNovaTag) {
  const [estado, acao, pendente] = useActionState(
    criarTagFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  return (
    <form action={acao} noValidate className="flex flex-col gap-3">
      <CampoCredencial credencial={credencial} />
      <h2 className="text-base font-semibold">{textosTags.tituloNova}</h2>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div
        key={estado.tentativa}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-3">
          <CampoFormulario
            id="nova-tag-nome"
            name={CAMPOS_TAG.NOME}
            rotulo={textosTags.rotuloNome}
            defaultValue={lerValorTexto(estado.valores, CAMPOS_TAG.NOME)}
            erros={estado.errosCampos?.nome}
            maxLength={LIMITES_TEXTO.NOME_TAG}
            autoComplete="off"
            required
          />
          <CampoCorOpcional
            nome={CAMPOS_TAG.COR}
            rotulo={textosTags.rotuloCor}
            rotuloPadrao={textosTags.semCor}
            valorInicial={lerValorTexto(estado.valores, CAMPOS_TAG.COR) || null}
            corPadrao={COR_TAG_NEUTRA}
            sugestoes={CORES_SUGERIDAS_TAG}
            erros={estado.errosCampos?.[CAMPOS_TAG.COR]}
          />
          <CampoFormulario
            id="nova-tag-solicitante-padrao"
            name={CAMPOS_TAG.SOLICITANTE_PADRAO}
            rotulo={textosTags.rotuloSolicitantePadrao}
            dica={textosTags.dicaSolicitantePadrao}
            defaultValue={lerValorTexto(
              estado.valores,
              CAMPOS_TAG.SOLICITANTE_PADRAO,
            )}
            erros={estado.errosCampos?.[CAMPOS_TAG.SOLICITANTE_PADRAO]}
            list={idListaSolicitantes}
            maxLength={LIMITES_TEXTO.NOME_SOLICITANTE}
            autoComplete="off"
          />
        </div>
        <Botao type="submit" disabled={pendente}>
          {pendente ? textosTags.botaoCriando : textosTags.botaoCriar}
        </Botao>
      </div>
    </form>
  );
}
