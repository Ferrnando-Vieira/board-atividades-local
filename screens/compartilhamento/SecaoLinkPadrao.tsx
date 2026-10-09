'use client';

import { useActionState, useId, useState } from 'react';
import Botao from '@/components/ui/Botao';
import CampoCopiavel from '@/components/ui/CampoCopiavel';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { textosCompartilhamento as textos } from '@/screens/compartilhamento/textosCompartilhamento';
import {
  ativarLinkPadraoFormulario,
  renovarLinkPadraoFormulario,
} from '@/servidor/web/acoes/acoesCompartilhamento';
import {
  ESTADO_FORMULARIO_GESTAO_INICIAL,
  type EstadoFormularioGestao,
} from '@/types/formulario';

function MensagensEstado({ estado }: { estado: EstadoFormularioGestao }) {
  return (
    <>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
    </>
  );
}

function FormularioRenovacao() {
  const [estado, acao, renovando] = useActionState(
    renovarLinkPadraoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [dialogoNaTentativa, setDialogoNaTentativa] = useState<number | null>(
    null,
  );
  return (
    <form action={acao} className="flex flex-col gap-2">
      <div>
        <Botao
          variante="secundario"
          onClick={() => setDialogoNaTentativa(estado.tentativa)}
          disabled={renovando}
        >
          {renovando
            ? textos.renovandoLinkPadrao
            : textos.botaoRenovarLinkPadrao}
        </Botao>
      </div>
      <DialogoConfirmacao
        aberto={dialogoNaTentativa === estado.tentativa}
        titulo={textos.tituloRenovacao}
        rotuloConfirmar={textos.botaoRenovarLinkPadrao}
        rotuloConfirmando={textos.renovandoLinkPadrao}
        rotuloCancelar={textos.botaoCancelar}
        pendente={renovando}
        aoCancelar={() => setDialogoNaTentativa(null)}
      >
        <p>{textos.descricaoRenovacao}</p>
      </DialogoConfirmacao>
      <MensagensEstado estado={estado} />
    </form>
  );
}

function FormularioAtivacao() {
  const [estado, acao, ativando] = useActionState(
    ativarLinkPadraoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  return (
    <form action={acao} className="flex flex-col gap-2">
      <p className="text-sm text-texto-suave">{textos.linkPadraoAusente}</p>
      <div>
        <Botao type="submit" disabled={ativando}>
          {ativando ? textos.ativandoLinkPadrao : textos.botaoAtivarLinkPadrao}
        </Botao>
      </div>
      <MensagensEstado estado={estado} />
    </form>
  );
}

type PropriedadesSecaoLinkPadrao = {
  urlLinkPadrao: string | null;
};

// O endereço completo pode ser exibido de novo porque o token é derivado de
// uma chave guardada fora do banco; os demais links continuam mostrando o
// endereço só na criação.
export default function SecaoLinkPadrao({
  urlLinkPadrao,
}: PropriedadesSecaoLinkPadrao) {
  const idCampo = useId();
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-primaria/30 bg-primaria/5 p-3">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{textos.tituloLinkPadrao}</h3>
        <p className="text-xs text-texto-suave">{textos.descricaoLinkPadrao}</p>
      </header>
      {urlLinkPadrao ? (
        <>
          <CampoCopiavel
            id={idCampo}
            rotulo={textos.rotuloLinkPadrao}
            valor={urlLinkPadrao}
            rotuloCopiar={textos.botaoCopiar}
            avisoCopiado={textos.avisoCopiado}
            avisoSelecionado={textos.avisoSelecionado}
          />
          <FormularioRenovacao />
        </>
      ) : (
        <FormularioAtivacao />
      )}
    </section>
  );
}
