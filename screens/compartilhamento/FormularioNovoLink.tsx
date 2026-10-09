'use client';

import { useActionState, useId } from 'react';
import SeletorAnimal from '@/components/animais/SeletorAnimal';
import Botao from '@/components/ui/Botao';
import CampoCopiavel from '@/components/ui/CampoCopiavel';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { ehChaveAnimal } from '@/config/animais';
import { CAMPOS_COMPARTILHAMENTO } from '@/config/camposFormulario';
import { OPCOES_VALIDADE_DIAS } from '@/config/constantesSeguranca';
import CamposConfiguracaoLink from '@/screens/compartilhamento/CamposConfiguracaoLink';
import {
  descreverValidade,
  textosCompartilhamento as textos,
} from '@/screens/compartilhamento/textosCompartilhamento';
import type { OpcaoEscopo } from '@/screens/compartilhamento/tiposCompartilhamento';
import { criarLinkCompartilhamentoFormulario } from '@/servidor/web/acoes/acoesCompartilhamento';
import { ESTADO_CRIACAO_CREDENCIAL_INICIAL } from '@/types/formulario';
import { lerValorTexto } from '@/util/FormularioUtils';

export const OPCOES_VALIDADE = [
  { valor: '', rotulo: textos.semExpiracao },
  ...OPCOES_VALIDADE_DIAS.map((dias) => ({
    valor: String(dias),
    rotulo: descreverValidade(dias),
  })),
];

type PropriedadesFormularioNovoLink = {
  tags: readonly OpcaoEscopo[];
  solicitantes: readonly OpcaoEscopo[];
};

export default function FormularioNovoLink({
  tags,
  solicitantes,
}: PropriedadesFormularioNovoLink) {
  const [estado, acao, pendente] = useActionState(
    criarLinkCompartilhamentoFormulario,
    ESTADO_CRIACAO_CREDENCIAL_INICIAL,
  );
  const idLink = useId();
  const animalEnviado = lerValorTexto(
    estado.valores,
    CAMPOS_COMPARTILHAMENTO.ANIMAL,
  );
  return (
    <form action={acao} noValidate className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">{textos.tituloNovo}</h3>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.credencialGerada && (
        <div className="flex flex-col gap-2">
          <MensagemAlerta tipo="sucesso">
            {estado.mensagemSucesso}
          </MensagemAlerta>
          <CampoCopiavel
            id={idLink}
            rotulo={textos.rotuloLinkGerado}
            valor={estado.credencialGerada}
            rotuloCopiar={textos.botaoCopiar}
            avisoCopiado={textos.avisoCopiado}
            avisoSelecionado={textos.avisoSelecionado}
          />
        </div>
      )}
      <CamposConfiguracaoLink
        key={estado.tentativa}
        valores={estado.valores}
        erros={estado.errosCampos ?? {}}
        tags={tags}
        solicitantes={solicitantes}
        opcoesValidade={OPCOES_VALIDADE}
        validadeInicial=""
      />
      <SeletorAnimal
        key={`animal-${estado.tentativa}`}
        nome={CAMPOS_COMPARTILHAMENTO.ANIMAL}
        legenda={textos.legendaAnimal}
        dica={textos.dicaAnimal}
        rotuloSorteado={textos.animalSorteado}
        valorInicial={ehChaveAnimal(animalEnviado) ? animalEnviado : null}
        erros={estado.errosCampos?.[CAMPOS_COMPARTILHAMENTO.ANIMAL]}
      />
      <div>
        <Botao type="submit" disabled={pendente}>
          {pendente ? textos.botaoGerando : textos.botaoGerar}
        </Botao>
      </div>
    </form>
  );
}
