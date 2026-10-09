'use client';

import { useActionState } from 'react';
import Botao from '@/components/ui/Botao';
import CampoFormulario from '@/components/ui/CampoFormulario';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { LIMITES_TEXTO } from '@/config/constantes';
import {
  SENHA_ADMINISTRADOR,
  USUARIO_ADMINISTRADOR,
} from '@/config/constantesSeguranca';
import {
  montarDicaSenha,
  textosConfiguracaoInicial as textos,
} from '@/screens/configuracaoInicial/textosConfiguracaoInicial';
import { concluirConfiguracao } from '@/servidor/web/acoes/acoesConfiguracaoInicial';
import { ESTADO_FORMULARIO_INICIAL } from '@/types/formulario';

export default function FormularioConfiguracaoInicial() {
  const [estado, acao, pendente] = useActionState(
    concluirConfiguracao,
    ESTADO_FORMULARIO_INICIAL,
  );
  const erros = estado.errosCampos ?? {};
  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      <CampoFormulario
        id="codigo"
        name="codigo"
        rotulo={textos.rotuloCodigo}
        dica={textos.dicaCodigo}
        erros={erros.codigo}
        autoComplete="one-time-code"
        autoCapitalize="characters"
        required
      />
      <CampoFormulario
        id="usuario"
        name="usuario"
        rotulo={textos.rotuloUsuario}
        dica={textos.dicaUsuario}
        erros={erros.usuario}
        autoComplete="username"
        autoCapitalize="none"
        minLength={USUARIO_ADMINISTRADOR.TAMANHO_MINIMO}
        maxLength={USUARIO_ADMINISTRADOR.TAMANHO_MAXIMO}
        required
      />
      <CampoFormulario
        id="senha"
        name="senha"
        type="password"
        rotulo={textos.rotuloSenha}
        dica={montarDicaSenha(SENHA_ADMINISTRADOR.TAMANHO_MINIMO)}
        erros={erros.senha}
        autoComplete="new-password"
        minLength={SENHA_ADMINISTRADOR.TAMANHO_MINIMO}
        maxLength={SENHA_ADMINISTRADOR.TAMANHO_MAXIMO}
        required
      />
      <CampoFormulario
        id="confirmacaoSenha"
        name="confirmacaoSenha"
        type="password"
        rotulo={textos.rotuloConfirmacaoSenha}
        erros={erros.confirmacaoSenha}
        autoComplete="new-password"
        maxLength={SENHA_ADMINISTRADOR.TAMANHO_MAXIMO}
        required
      />
      <CampoFormulario
        id="solicitantePadrao"
        name="solicitantePadrao"
        rotulo={textos.rotuloSolicitantePadrao}
        dica={textos.dicaSolicitantePadrao}
        erros={erros.solicitantePadrao}
        autoComplete="name"
        maxLength={LIMITES_TEXTO.NOME_SOLICITANTE}
        required
      />
      <Botao type="submit" disabled={pendente}>
        {pendente ? textos.botaoConcluindo : textos.botaoConcluir}
      </Botao>
    </form>
  );
}
