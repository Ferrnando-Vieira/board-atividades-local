'use client';

import { useActionState, useId } from 'react';
import Botao from '@/components/ui/Botao';
import CampoFormulario from '@/components/ui/CampoFormulario';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_SOLICITANTE } from '@/config/camposFormulario';
import { LIMITES_TEXTO } from '@/config/constantes';
import { textosSolicitantes as textos } from '@/screens/solicitantes/textosSolicitantes';
import { salvarSolicitantePadraoFormulario } from '@/servidor/web/acoes/acoesSolicitantes';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { lerValorTexto } from '@/util/FormularioUtils';

type PropriedadesFormularioSolicitantePadrao = {
  padraoAtual: string | null;
  nomesCadastrados: readonly string[];
};

export default function FormularioSolicitantePadrao({
  padraoAtual,
  nomesCadastrados,
}: PropriedadesFormularioSolicitantePadrao) {
  const [estado, acao, pendente] = useActionState(
    salvarSolicitantePadraoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const idLista = useId();
  // Depois de salvar, o campo volta ao padrão gravado (a página é revalidada);
  // depois de um erro, mantém o que foi digitado.
  const valorInicial = estado.mensagemErro
    ? lerValorTexto(estado.valores, CAMPOS_SOLICITANTE.NOME)
    : (padraoAtual ?? '');
  return (
    <form action={acao} noValidate className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{textos.tituloPadrao}</h2>
      {!padraoAtual && (
        <MensagemAlerta tipo="aviso">{textos.semPadrao}</MensagemAlerta>
      )}
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
      <div
        key={`${estado.tentativa}-${padraoAtual ?? ''}`}
        className="flex flex-col"
      >
        <CampoFormulario
          id="solicitante-padrao-nome"
          name={CAMPOS_SOLICITANTE.NOME}
          rotulo={textos.rotuloNome}
          dica={textos.dicaNome}
          defaultValue={valorInicial}
          erros={estado.errosCampos?.[CAMPOS_SOLICITANTE.NOME]}
          list={idLista}
          maxLength={LIMITES_TEXTO.NOME_SOLICITANTE}
          autoComplete="off"
          required
        />
        <datalist id={idLista}>
          {nomesCadastrados.map((nome) => (
            <option key={nome} value={nome} />
          ))}
        </datalist>
      </div>
      <Botao type="submit" disabled={pendente} className="sm:self-start">
        {pendente ? textos.botaoSalvando : textos.botaoSalvar}
      </Botao>
    </form>
  );
}
