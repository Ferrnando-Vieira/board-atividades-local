'use client';

import { useState } from 'react';
import Botao from '@/components/ui/Botao';
import DialogoModal from '@/components/ui/DialogoModal';
import Icone from '@/components/ui/Icone';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import FormularioNovoLink from '@/screens/compartilhamento/FormularioNovoLink';
import ItemLink from '@/screens/compartilhamento/ItemLink';
import SecaoLinkPadrao from '@/screens/compartilhamento/SecaoLinkPadrao';
import { textosCompartilhamento as textos } from '@/screens/compartilhamento/textosCompartilhamento';
import type {
  LinkExibido,
  OpcaoEscopo,
} from '@/screens/compartilhamento/tiposCompartilhamento';

type PropriedadesPainelCompartilhamento = {
  urlBase: string;
  // Sem IP de rede local detectado: os links só abrem nesta máquina.
  somenteLocal: boolean;
  urlLinkPadrao: string | null;
  links: LinkExibido[];
  tags: OpcaoEscopo[];
  solicitantes: OpcaoEscopo[];
};

export default function PainelCompartilhamento({
  urlBase,
  somenteLocal,
  urlLinkPadrao,
  links,
  tags,
  solicitantes,
}: PropriedadesPainelCompartilhamento) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao
        variante="secundario"
        className="w-auto"
        onClick={() => setAberto(true)}
      >
        <Icone nome="compartilhar" />
        {textos.botaoAbrir}
      </Botao>
      <DialogoModal
        aberto={aberto}
        titulo={textos.titulo}
        rotuloFechar={textos.fechar}
        aoFechar={() => setAberto(false)}
      >
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-fundo/70 px-3 py-2 text-sm">
          <Icone nome="link" className="text-primaria" />
          <span className="text-texto-suave">{textos.rotuloEndereco}</span>
          <code className="font-mono font-semibold break-all">{urlBase}</code>
        </p>
        {somenteLocal && (
          <MensagemAlerta tipo="aviso">
            {textos.avisoSomenteLocal}
          </MensagemAlerta>
        )}
        <p className="text-sm text-texto-suave">{textos.descricao}</p>
        <SecaoLinkPadrao urlLinkPadrao={urlLinkPadrao} />
        <section className="flex flex-col gap-3 rounded-lg border border-borda p-3">
          <FormularioNovoLink tags={tags} solicitantes={solicitantes} />
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="text-base font-semibold">{textos.tituloLista}</h3>
          {links.length === 0 ? (
            <p className="text-sm text-texto-suave">{textos.listaVazia}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda">
              {links.map((link) => (
                <ItemLink key={link.id} link={link} />
              ))}
            </ul>
          )}
        </section>
      </DialogoModal>
    </>
  );
}
