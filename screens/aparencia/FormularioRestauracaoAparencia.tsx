'use client';

import { useActionState } from 'react';
import Botao from '@/components/ui/Botao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { textosAparencia as textos } from '@/screens/aparencia/textosAparencia';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { restaurarAparenciaBoardFormulario } from '@/servidor/web/acoes/acoesFundo';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';

type PropriedadesFormularioRestauracaoAparencia = {
  credencial: string | null;
};

// Apaga a aparência própria do link: ele volta a seguir a do board.
export default function FormularioRestauracaoAparencia({
  credencial,
}: PropriedadesFormularioRestauracaoAparencia) {
  const [estado, acao, pendente] = useActionState(
    restaurarAparenciaBoardFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  return (
    <form action={acao} className="flex shrink-0 flex-col gap-2">
      <CampoCredencial credencial={credencial} />
      <Botao type="submit" variante="secundario" disabled={pendente}>
        {pendente ? textos.restaurando : textos.botaoRestaurar}
      </Botao>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
    </form>
  );
}
