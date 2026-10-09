'use client';

import { useActionState, useState } from 'react';
import Botao from '@/components/ui/Botao';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_COMPARTILHAMENTO } from '@/config/camposFormulario';
import { textosCompartilhamento as textos } from '@/screens/compartilhamento/textosCompartilhamento';
import { tornarEnderecoCopiavelFormulario } from '@/servidor/web/acoes/acoesCompartilhamento';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';

type PropriedadesFormularioEnderecoCopiavel = {
  linkId: number;
};

export default function FormularioEnderecoCopiavel({
  linkId,
}: PropriedadesFormularioEnderecoCopiavel) {
  const [estado, acao, gerando] = useActionState(
    tornarEnderecoCopiavelFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [dialogoNaTentativa, setDialogoNaTentativa] = useState<number | null>(
    null,
  );
  return (
    <form action={acao} className="flex flex-col gap-2">
      <input
        type="hidden"
        name={CAMPOS_COMPARTILHAMENTO.LINK_ID}
        value={linkId}
      />
      <p className="text-xs text-texto-suave">{textos.enderecoIndisponivel}</p>
      <div>
        <Botao
          variante="secundario"
          onClick={() => setDialogoNaTentativa(estado.tentativa)}
          disabled={gerando}
        >
          {gerando
            ? textos.gerandoEnderecoCopiavel
            : textos.botaoEnderecoCopiavel}
        </Botao>
      </div>
      <DialogoConfirmacao
        aberto={dialogoNaTentativa === estado.tentativa}
        titulo={textos.tituloEnderecoCopiavel}
        rotuloConfirmar={textos.botaoEnderecoCopiavel}
        rotuloConfirmando={textos.gerandoEnderecoCopiavel}
        rotuloCancelar={textos.botaoCancelar}
        pendente={gerando}
        aoCancelar={() => setDialogoNaTentativa(null)}
      >
        <p>{textos.descricaoEnderecoCopiavel}</p>
      </DialogoConfirmacao>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
    </form>
  );
}
