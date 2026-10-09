'use client';

import { useEffect, useState } from 'react';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { PARAMETRO_AVISO, type Aviso } from '@/config/rotas';
import {
  textosAplicacao,
  textosAvisos,
} from '@/screens/aplicacao/textosAplicacao';

type PropriedadesAvisoSucesso = {
  aviso: Aviso | null;
};

// O parâmetro sai da URL assim que o aviso é exibido, para que recarregar a
// página não repita uma confirmação de algo que já aconteceu.
export default function AvisoSucesso({ aviso }: PropriedadesAvisoSucesso) {
  const [avisoFechado, setAvisoFechado] = useState<Aviso | null>(null);

  useEffect(() => {
    if (!aviso) {
      return;
    }
    const endereco = new URL(window.location.href);
    endereco.searchParams.delete(PARAMETRO_AVISO);
    window.history.replaceState(null, '', endereco);
  }, [aviso]);

  if (!aviso || avisoFechado === aviso) {
    return null;
  }
  return (
    <MensagemAlerta tipo="sucesso">
      <div className="flex items-start justify-between gap-3">
        <span>{textosAvisos[aviso]}</span>
        <button
          type="button"
          onClick={() => setAvisoFechado(aviso)}
          aria-label={textosAplicacao.fecharAviso}
          className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-sucesso/10 focus-visible:outline-2 focus-visible:outline-primaria"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </MensagemAlerta>
  );
}
