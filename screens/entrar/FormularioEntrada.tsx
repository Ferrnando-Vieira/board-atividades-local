'use client';

import { useActionState } from 'react';
import Botao from '@/components/ui/Botao';
import CampoFormulario from '@/components/ui/CampoFormulario';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { USUARIO_ADMINISTRADOR } from '@/config/constantesSeguranca';
import { textosEntrada } from '@/screens/entrar/textosEntrada';
import { entrar } from '@/servidor/web/acoes/acoesAutenticacao';
import { ESTADO_FORMULARIO_INICIAL } from '@/types/formulario';

export default function FormularioEntrada() {
  const [estado, acao, pendente] = useActionState(
    entrar,
    ESTADO_FORMULARIO_INICIAL,
  );
  return (
    <form action={acao} className="flex flex-col gap-4" noValidate>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      <CampoFormulario
        id="usuario"
        name="usuario"
        rotulo={textosEntrada.rotuloUsuario}
        autoComplete="username"
        autoCapitalize="none"
        maxLength={USUARIO_ADMINISTRADOR.TAMANHO_MAXIMO}
        required
      />
      <CampoFormulario
        id="senha"
        name="senha"
        type="password"
        rotulo={textosEntrada.rotuloSenha}
        autoComplete="current-password"
        required
      />
      <Botao type="submit" disabled={pendente}>
        {pendente ? textosEntrada.botaoEntrando : textosEntrada.botaoEntrar}
      </Botao>
    </form>
  );
}
