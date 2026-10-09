'use client';

import { useActionState } from 'react';
import Botao from '@/components/ui/Botao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_COMPARTILHAMENTO } from '@/config/camposFormulario';
import { VALOR_CAMPO_MARCADO } from '@/config/constantes';
import CamposConfiguracaoLink from '@/screens/compartilhamento/CamposConfiguracaoLink';
import { OPCOES_VALIDADE } from '@/screens/compartilhamento/FormularioNovoLink';
import { textosCompartilhamento as textos } from '@/screens/compartilhamento/textosCompartilhamento';
import type {
  LinkExibido,
  OpcaoEscopo,
} from '@/screens/compartilhamento/tiposCompartilhamento';
import { VALOR_MANTER_VALIDADE } from '@/servidor/compartilhamento/esquemasCompartilhamento';
import { editarLinkCompartilhamentoFormulario } from '@/servidor/web/acoes/acoesCompartilhamento';
import {
  ESTADO_FORMULARIO_GESTAO_INICIAL,
  type ValoresFormulario,
} from '@/types/formulario';

function montarValoresDoLink(link: LinkExibido): ValoresFormulario {
  return {
    [CAMPOS_COMPARTILHAMENTO.NOME]: link.nome,
    [CAMPOS_COMPARTILHAMENTO.MODALIDADE]: link.modalidade,
    [CAMPOS_COMPARTILHAMENTO.TAGS]: link.tags.map((tag) => String(tag.id)),
    [CAMPOS_COMPARTILHAMENTO.SOLICITANTES]: link.solicitantes.map(
      (solicitante) => String(solicitante.id),
    ),
    [CAMPOS_COMPARTILHAMENTO.INCLUIR_ARQUIVADAS]: link.incluirArquivadas
      ? VALOR_CAMPO_MARCADO
      : '',
  };
}

type PropriedadesFormularioEdicaoLink = {
  link: LinkExibido;
  tags: readonly OpcaoEscopo[];
  solicitantes: readonly OpcaoEscopo[];
};

export default function FormularioEdicaoLink({
  link,
  tags,
  solicitantes,
}: PropriedadesFormularioEdicaoLink) {
  const [estado, acao, salvando] = useActionState(
    editarLinkCompartilhamentoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const opcoesValidade = [
    {
      valor: VALOR_MANTER_VALIDADE,
      rotulo: textos.manterValidade(link.expiraEm),
    },
    ...OPCOES_VALIDADE,
  ];
  return (
    <form
      action={acao}
      noValidate
      className="flex flex-col gap-4 border-t border-borda p-3"
    >
      <input
        type="hidden"
        name={CAMPOS_COMPARTILHAMENTO.LINK_ID}
        value={link.id}
      />
      <CamposConfiguracaoLink
        key={estado.tentativa}
        valores={estado.valores ?? montarValoresDoLink(link)}
        erros={estado.errosCampos ?? {}}
        tags={tags}
        solicitantes={solicitantes}
        opcoesValidade={opcoesValidade}
        validadeInicial={VALOR_MANTER_VALIDADE}
      />
      <div>
        <Botao type="submit" disabled={salvando}>
          {salvando ? textos.botaoSalvandoLink : textos.botaoSalvarLink}
        </Botao>
      </div>
      {estado.mensagemErro && (
        <MensagemAlerta tipo="erro">{estado.mensagemErro}</MensagemAlerta>
      )}
      {estado.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">{estado.mensagemSucesso}</MensagemAlerta>
      )}
    </form>
  );
}
