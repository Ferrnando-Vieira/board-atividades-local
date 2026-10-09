'use client';

import { useActionState, useState } from 'react';
import Botao from '@/components/ui/Botao';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_ANEXO } from '@/config/camposFormulario';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import { removerAnexoFormulario } from '@/servidor/web/acoes/acoesAnexos';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';

type PropriedadesFormularioRemocaoAnexo = {
  atividadeId: number;
  anexoId: number;
  nomeArquivo: string;
  usadoNaDescricao: boolean;
  credencial: string | null;
};

// Em caso de sucesso a lista é revalidada sem o anexo e este formulário sai
// da tela; em caso de falha a mensagem aparece dentro da confirmação.
export default function FormularioRemocaoAnexo({
  atividadeId,
  anexoId,
  nomeArquivo,
  usadoNaDescricao,
  credencial,
}: PropriedadesFormularioRemocaoAnexo) {
  const [estado, acao, pendente] = useActionState(
    removerAnexoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [confirmando, setConfirmando] = useState(false);
  return (
    <form action={acao}>
      <CampoCredencial credencial={credencial} />
      <input
        type="hidden"
        name={CAMPOS_ANEXO.ATIVIDADE_ID}
        value={atividadeId}
      />
      <input type="hidden" name={CAMPOS_ANEXO.ANEXO_ID} value={anexoId} />
      <Botao
        variante="secundario"
        onClick={() => setConfirmando(true)}
        aria-label={textosAtividades.descreverRemocaoAnexo(nomeArquivo)}
      >
        {textosAtividades.removerAnexo}
      </Botao>
      <DialogoConfirmacao
        aberto={confirmando}
        titulo={textosAtividades.tituloRemocaoAnexo}
        rotuloConfirmar={textosAtividades.removerAnexo}
        rotuloConfirmando={textosAtividades.removendoAnexo}
        rotuloCancelar={textosAtividades.cancelar}
        pendente={pendente}
        aoCancelar={() => setConfirmando(false)}
      >
        <p className="break-words">
          {textosAtividades.confirmarRemocaoAnexo(nomeArquivo)}
        </p>
        {usadoNaDescricao && (
          <MensagemAlerta tipo="aviso">
            {textosAtividades.avisoImagemNaDescricao}
          </MensagemAlerta>
        )}
        {estado.mensagemErro && (
          <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
        )}
      </DialogoConfirmacao>
    </form>
  );
}
