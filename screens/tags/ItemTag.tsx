'use client';

import { useActionState, useState } from 'react';
import Botao from '@/components/ui/Botao';
import CampoCorOpcional from '@/components/ui/CampoCorOpcional';
import CampoFormulario from '@/components/ui/CampoFormulario';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_TAG } from '@/config/camposFormulario';
import { LIMITES_TEXTO } from '@/config/constantes';
import { COR_TAG_NEUTRA, CORES_SUGERIDAS_TAG } from '@/config/coresTags';
import CampoCredencial from '@/screens/aplicacao/CampoCredencial';
import { textosTags } from '@/screens/tags/textosTags';
import type { TagGerenciavel } from '@/servidor/classificacao/consultasClassificacao';
import {
  editarTagFormulario,
  excluirTagFormulario,
} from '@/servidor/web/acoes/acoesTags';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { montarEstiloTag } from '@/util/AparenciaUtils';
import { lerValorTexto } from '@/util/FormularioUtils';

type PropriedadesItemTag = {
  tag: TagGerenciavel;
  credencial: string | null;
  // Datalist com os solicitantes cadastrados, renderizada pela tela.
  idListaSolicitantes: string;
};

export default function ItemTag({
  tag,
  credencial,
  idListaSolicitantes,
}: PropriedadesItemTag) {
  const [estadoEdicao, acaoEdicao, salvando] = useActionState(
    editarTagFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [estadoExclusao, acaoExclusao, excluindo] = useActionState(
    excluirTagFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [dialogoAbertoNaTentativa, setDialogoAbertoNaTentativa] = useState<
    number | null
  >(null);
  const prefixo = `tag-${tag.id}`;

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span
          className="inline-flex max-w-full items-center rounded-full border border-borda bg-fundo px-3 py-0.5 text-sm font-medium break-words text-texto"
          style={montarEstiloTag(tag.cor)}
        >
          {tag.nome}
        </span>
        <span className="text-xs text-texto-suave">
          {textosTags.descreverUso(tag.quantidadeAtividades)}
          {tag.solicitantePadrao &&
            ` · ${textosTags.descreverSolicitantePadrao(tag.solicitantePadrao)}`}
        </span>
      </div>
      <form
        action={acaoEdicao}
        noValidate
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <CampoCredencial credencial={credencial} />
        <input type="hidden" name={CAMPOS_TAG.TAG_ID} value={tag.id} />
        <input type="hidden" name={CAMPOS_TAG.NOME_ATUAL} value={tag.nome} />
        <div
          key={estadoEdicao.tentativa}
          className="flex flex-1 flex-col gap-3"
        >
          <CampoFormulario
            id={`${prefixo}-nome`}
            name={CAMPOS_TAG.NOME}
            rotulo={textosTags.rotuloRenomear(tag.nome)}
            defaultValue={
              lerValorTexto(estadoEdicao.valores, CAMPOS_TAG.NOME) ?? tag.nome
            }
            erros={estadoEdicao.errosCampos?.nome}
            maxLength={LIMITES_TEXTO.NOME_TAG}
            autoComplete="off"
            required
          />
          <CampoCorOpcional
            nome={CAMPOS_TAG.COR}
            rotulo={textosTags.rotuloCorDaTag(tag.nome)}
            rotuloPadrao={textosTags.semCor}
            valorInicial={
              estadoEdicao.valores
                ? lerValorTexto(estadoEdicao.valores, CAMPOS_TAG.COR) || null
                : tag.cor
            }
            corPadrao={COR_TAG_NEUTRA}
            sugestoes={CORES_SUGERIDAS_TAG}
            erros={estadoEdicao.errosCampos?.[CAMPOS_TAG.COR]}
          />
          <CampoFormulario
            id={`${prefixo}-solicitante-padrao`}
            name={CAMPOS_TAG.SOLICITANTE_PADRAO}
            rotulo={textosTags.rotuloSolicitanteDaTag(tag.nome)}
            dica={textosTags.dicaSolicitantePadrao}
            defaultValue={
              lerValorTexto(
                estadoEdicao.valores,
                CAMPOS_TAG.SOLICITANTE_PADRAO,
              ) ??
              tag.solicitantePadrao ??
              ''
            }
            erros={estadoEdicao.errosCampos?.[CAMPOS_TAG.SOLICITANTE_PADRAO]}
            list={idListaSolicitantes}
            maxLength={LIMITES_TEXTO.NOME_SOLICITANTE}
            autoComplete="off"
          />
        </div>
        <Botao type="submit" variante="secundario" disabled={salvando}>
          {salvando ? textosTags.botaoSalvando : textosTags.botaoSalvar}
        </Botao>
      </form>
      <form action={acaoExclusao}>
        <CampoCredencial credencial={credencial} />
        <input type="hidden" name={CAMPOS_TAG.TAG_ID} value={tag.id} />
        <input type="hidden" name={CAMPOS_TAG.NOME_ATUAL} value={tag.nome} />
        <Botao
          variante="perigo"
          onClick={() => setDialogoAbertoNaTentativa(estadoExclusao.tentativa)}
          disabled={excluindo}
        >
          {textosTags.botaoExcluir}
        </Botao>
        <DialogoConfirmacao
          aberto={dialogoAbertoNaTentativa === estadoExclusao.tentativa}
          titulo={textosTags.tituloExclusao(tag.nome)}
          rotuloConfirmar={textosTags.botaoExcluir}
          rotuloConfirmando={textosTags.botaoExcluindo}
          rotuloCancelar={textosTags.botaoCancelar}
          pendente={excluindo}
          aoCancelar={() => setDialogoAbertoNaTentativa(null)}
        >
          <p>{textosTags.descreverExclusao(tag.quantidadeAtividades)}</p>
        </DialogoConfirmacao>
      </form>
      {estadoEdicao.mensagemErro && (
        <MensagemAlerta tipo="erro">{estadoEdicao.mensagemErro}</MensagemAlerta>
      )}
      {estadoEdicao.mensagemSucesso && (
        <MensagemAlerta tipo="sucesso">
          {estadoEdicao.mensagemSucesso}
        </MensagemAlerta>
      )}
      {estadoExclusao.mensagemErro && (
        <MensagemAlerta tipo="erro">
          {estadoExclusao.mensagemErro}
        </MensagemAlerta>
      )}
    </li>
  );
}
