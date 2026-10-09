'use client';

import { useActionState, useState } from 'react';
import Botao from '@/components/ui/Botao';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_TOKEN_API } from '@/config/camposFormulario';
import { textosIntegracoes as textos } from '@/screens/integracoes/textosIntegracoes';
import type { TokenApiExibido } from '@/screens/integracoes/tiposIntegracoes';
import type { SituacaoCredencial } from '@/servidor/seguranca/tokens';
import { revogarTokenApiFormulario } from '@/servidor/web/acoes/acoesTokensApi';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { combinarClasses } from '@/util/ClassesUtils';

const CLASSES_SITUACAO: Record<SituacaoCredencial, string> = {
  ativo: 'bg-sucesso-fundo text-sucesso',
  expirado: 'bg-aviso-fundo text-aviso',
  revogado: 'bg-erro-fundo text-erro',
};

function descreverDatas(token: TokenApiExibido): string {
  const partes = [
    textos.descreverCriacao(token.criadoEm),
    token.expiraEm
      ? textos.descreverExpiracao(token.expiraEm)
      : textos.semExpiracaoCurto,
    token.ultimoUsoEm
      ? textos.descreverUltimoUso(token.ultimoUsoEm)
      : textos.nuncaUsado,
    token.revogadoEm ? textos.descreverRevogacao(token.revogadoEm) : null,
  ];
  return partes.filter((parte) => parte !== null).join(' · ');
}

type PropriedadesItemTokenApi = {
  token: TokenApiExibido;
};

export default function ItemTokenApi({ token }: PropriedadesItemTokenApi) {
  const [estado, acao, revogando] = useActionState(
    revogarTokenApiFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [dialogoAbertoNaTentativa, setDialogoAbertoNaTentativa] = useState<
    number | null
  >(null);
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium break-words">{token.nome}</span>
        <span
          className={combinarClasses(
            'rounded px-1.5 text-xs font-medium',
            CLASSES_SITUACAO[token.situacao],
          )}
        >
          {textos.situacoes[token.situacao]}
        </span>
      </div>
      <p className="font-mono text-xs">
        {textos.descreverPrefixo(token.prefixo)}
      </p>
      <ul className="flex flex-wrap gap-1">
        {token.permissoes.map((permissao) => (
          <li
            key={permissao}
            className="rounded border border-borda px-1.5 font-mono text-xs"
          >
            {permissao}
          </li>
        ))}
      </ul>
      <p className="text-xs text-texto-suave">{descreverDatas(token)}</p>
      {token.situacao !== 'revogado' && (
        <form action={acao}>
          <input
            type="hidden"
            name={CAMPOS_TOKEN_API.TOKEN_ID}
            value={token.id}
          />
          <Botao
            variante="perigo"
            onClick={() => setDialogoAbertoNaTentativa(estado.tentativa)}
            disabled={revogando}
          >
            {textos.botaoRevogar}
          </Botao>
          <DialogoConfirmacao
            aberto={dialogoAbertoNaTentativa === estado.tentativa}
            titulo={textos.tituloRevogacao(token.nome)}
            rotuloConfirmar={textos.botaoRevogar}
            rotuloConfirmando={textos.botaoRevogando}
            rotuloCancelar={textos.botaoCancelar}
            pendente={revogando}
            aoCancelar={() => setDialogoAbertoNaTentativa(null)}
          >
            <p>{textos.descricaoRevogacao}</p>
          </DialogoConfirmacao>
        </form>
      )}
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
    </li>
  );
}
