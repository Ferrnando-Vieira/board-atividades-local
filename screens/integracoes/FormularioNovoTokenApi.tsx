'use client';

import { useActionState, useId } from 'react';
import Botao from '@/components/ui/Botao';
import CampoCopiavel from '@/components/ui/CampoCopiavel';
import CampoFormulario from '@/components/ui/CampoFormulario';
import CampoMarcacao from '@/components/ui/CampoMarcacao';
import CampoSelecao from '@/components/ui/CampoSelecao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_TOKEN_API } from '@/config/camposFormulario';
import { LIMITES_TEXTO, PERMISSOES_API_OFERECIDAS } from '@/config/constantes';
import { OPCOES_VALIDADE_DIAS } from '@/config/constantesSeguranca';
import { descreverValidade } from '@/screens/compartilhamento/textosCompartilhamento';
import { textosIntegracoes as textos } from '@/screens/integracoes/textosIntegracoes';
import { criarTokenApiFormulario } from '@/servidor/web/acoes/acoesTokensApi';
import {
  ESTADO_CRIACAO_CREDENCIAL_INICIAL,
  type ValoresFormulario,
} from '@/types/formulario';
import { lerValorLista, lerValorTexto } from '@/util/FormularioUtils';

const OPCOES_VALIDADE = [
  { valor: '', rotulo: textos.semExpiracao },
  ...OPCOES_VALIDADE_DIAS.map((dias) => ({
    valor: String(dias),
    rotulo: descreverValidade(dias),
  })),
];

type PropriedadesCampos = {
  valores: ValoresFormulario | undefined;
  erros: Partial<Record<string, string[]>>;
};

function CamposNovoToken({ valores, erros }: PropriedadesCampos) {
  const prefixo = useId();
  const marcadas = new Set(
    lerValorLista(valores, CAMPOS_TOKEN_API.PERMISSOES) ?? [],
  );
  const errosPermissoes = erros[CAMPOS_TOKEN_API.PERMISSOES];
  return (
    <div className="flex flex-col gap-4">
      <CampoFormulario
        id={`${prefixo}-nome`}
        name={CAMPOS_TOKEN_API.NOME}
        rotulo={textos.rotuloNome}
        dica={textos.dicaNome}
        defaultValue={lerValorTexto(valores, CAMPOS_TOKEN_API.NOME)}
        erros={erros[CAMPOS_TOKEN_API.NOME]}
        maxLength={LIMITES_TEXTO.NOME_TOKEN_API}
        autoComplete="off"
        required
      />
      <fieldset className="flex flex-col gap-2 rounded-lg border border-borda p-3">
        <legend className="px-1 text-sm font-semibold">
          {textos.legendaPermissoes}
        </legend>
        {PERMISSOES_API_OFERECIDAS.map((permissao) => (
          <CampoMarcacao
            key={permissao}
            id={`${prefixo}-${permissao}`}
            name={CAMPOS_TOKEN_API.PERMISSOES}
            value={permissao}
            rotulo={textos.permissoes[permissao]}
            dica={permissao}
            defaultChecked={marcadas.has(permissao)}
          />
        ))}
        {errosPermissoes && errosPermissoes.length > 0 && (
          <p className="text-xs text-erro">{errosPermissoes.join(' ')}</p>
        )}
      </fieldset>
      <CampoSelecao
        id={`${prefixo}-validade`}
        name={CAMPOS_TOKEN_API.VALIDADE}
        rotulo={textos.rotuloValidade}
        opcoes={OPCOES_VALIDADE}
        defaultValue={lerValorTexto(valores, CAMPOS_TOKEN_API.VALIDADE) ?? ''}
        erros={erros[CAMPOS_TOKEN_API.VALIDADE]}
      />
    </div>
  );
}

export default function FormularioNovoTokenApi() {
  const [estado, acao, pendente] = useActionState(
    criarTokenApiFormulario,
    ESTADO_CRIACAO_CREDENCIAL_INICIAL,
  );
  const idToken = useId();
  return (
    <form action={acao} noValidate className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">{textos.tituloNovo}</h2>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.credencialGerada && (
        <div className="flex flex-col gap-2">
          <MensagemAlerta tipo="sucesso">
            {estado.mensagemSucesso}
          </MensagemAlerta>
          <CampoCopiavel
            id={idToken}
            rotulo={textos.rotuloTokenGerado}
            valor={estado.credencialGerada}
            rotuloCopiar={textos.botaoCopiar}
            avisoCopiado={textos.avisoCopiado}
            avisoSelecionado={textos.avisoSelecionado}
          />
        </div>
      )}
      <CamposNovoToken
        key={estado.tentativa}
        valores={estado.valores}
        erros={estado.errosCampos ?? {}}
      />
      <div>
        <Botao type="submit" disabled={pendente}>
          {pendente ? textos.botaoGerando : textos.botaoGerar}
        </Botao>
      </div>
    </form>
  );
}
