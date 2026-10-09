'use client';

import { useActionState, useState } from 'react';
import Botao from '@/components/ui/Botao';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import Icone from '@/components/ui/Icone';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_LEMBRETE_AVULSO } from '@/config/camposFormulario';
import type { SituacaoLembrete } from '@/config/constantes';
import FormularioLembreteAvulso, {
  type LembreteAvulsoEditavel,
} from '@/screens/lembretes/FormularioLembreteAvulso';
import { textosLembretes as textos } from '@/screens/lembretes/textosLembretes';
import {
  cancelarLembreteAvulsoFormulario,
  excluirLembreteAvulsoFormulario,
  reativarLembreteAvulsoFormulario,
} from '@/servidor/web/acoes/acoesLembretes';
import { ESTADO_FORMULARIO_GESTAO_INICIAL } from '@/types/formulario';
import { combinarClasses } from '@/util/ClassesUtils';

const CLASSES_SITUACAO: Record<SituacaoLembrete, string> = {
  pendente: 'bg-primaria-suave text-primaria-escura',
  disparado: 'bg-aviso-fundo text-aviso',
  cancelado: 'bg-fundo text-texto-suave',
};

export type LembreteAvulsoExibido = LembreteAvulsoEditavel & {
  situacao: SituacaoLembrete;
  horarioExibido: string;
  dispensado: boolean;
};

type PropriedadesItemLembreteAvulso = {
  lembrete: LembreteAvulsoExibido;
  dataMinima: string;
  fusoHorario: string;
};

function CamposIdentificacao({
  lembrete,
}: {
  lembrete: LembreteAvulsoExibido;
}) {
  return (
    <>
      <input
        type="hidden"
        name={CAMPOS_LEMBRETE_AVULSO.LEMBRETE_ID}
        value={lembrete.id}
      />
      <input
        type="hidden"
        name={CAMPOS_LEMBRETE_AVULSO.VERSAO}
        value={lembrete.versao}
      />
    </>
  );
}

export default function ItemLembreteAvulso({
  lembrete,
  dataMinima,
  fusoHorario,
}: PropriedadesItemLembreteAvulso) {
  const [editando, setEditando] = useState(false);
  const [estadoAlternancia, acaoAlternancia, alternando] = useActionState(
    lembrete.situacao === 'pendente'
      ? cancelarLembreteAvulsoFormulario
      : reativarLembreteAvulsoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [estadoExclusao, acaoExclusao, excluindo] = useActionState(
    excluirLembreteAvulsoFormulario,
    ESTADO_FORMULARIO_GESTAO_INICIAL,
  );
  const [dialogoNaTentativa, setDialogoNaTentativa] = useState<number | null>(
    null,
  );
  const erro = estadoAlternancia.mensagemErro ?? estadoExclusao.mensagemErro;
  return (
    <li
      id={`lembrete-${lembrete.id}`}
      className="flex scroll-mt-28 flex-col gap-3 py-4 first:pt-0 last:pb-0"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-medium break-words">{lembrete.titulo}</p>
          {lembrete.observacao && (
            <p className="text-sm break-words text-texto-suave">
              {lembrete.observacao}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-2 text-xs text-texto-suave">
            <span
              className={combinarClasses(
                'rounded-full px-2 py-0.5 font-semibold',
                CLASSES_SITUACAO[lembrete.situacao],
              )}
            >
              {textos.situacoes[lembrete.situacao]}
              {lembrete.dispensado && ` · ${textos.dispensado}`}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icone nome="relogio" className="size-3.5" />
              {lembrete.horarioExibido}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Botao
            variante="secundario"
            className="w-auto"
            aria-expanded={editando}
            aria-label={
              editando
                ? textos.botaoFecharEdicao
                : textos.descreverEdicao(lembrete.titulo)
            }
            onClick={() => setEditando((valor) => !valor)}
          >
            <Icone nome={editando ? 'fechar' : 'editar'} />
            {editando ? textos.botaoFecharEdicao : textos.botaoEditar}
          </Botao>
          {lembrete.situacao !== 'disparado' && (
            <form action={acaoAlternancia}>
              <CamposIdentificacao lembrete={lembrete} />
              <Botao
                type="submit"
                variante="fantasma"
                className="w-auto"
                disabled={alternando}
              >
                {lembrete.situacao === 'pendente'
                  ? textos.botaoCancelarLembrete
                  : textos.botaoReativar}
              </Botao>
            </form>
          )}
          <form action={acaoExclusao}>
            <CamposIdentificacao lembrete={lembrete} />
            <Botao
              variante="fantasma"
              className="w-auto text-erro hover:bg-erro-fundo"
              onClick={() => setDialogoNaTentativa(estadoExclusao.tentativa)}
              disabled={excluindo}
            >
              <Icone nome="lixeira" />
              {textos.botaoExcluir}
            </Botao>
            <DialogoConfirmacao
              aberto={dialogoNaTentativa === estadoExclusao.tentativa}
              titulo={textos.tituloExclusao(lembrete.titulo)}
              rotuloConfirmar={textos.botaoExcluir}
              rotuloConfirmando={textos.botaoExcluindo}
              rotuloCancelar={textos.cancelar}
              pendente={excluindo}
              aoCancelar={() => setDialogoNaTentativa(null)}
            >
              <p>{textos.confirmacaoExclusao}</p>
            </DialogoConfirmacao>
          </form>
        </div>
      </div>
      {erro && <MensagemAlerta tipo="erro">{erro}</MensagemAlerta>}
      {editando && (
        <div className="rounded-xl border border-borda bg-fundo/60 p-4">
          <FormularioLembreteAvulso
            lembrete={lembrete}
            dataMinima={dataMinima}
            fusoHorario={fusoHorario}
            aoSalvar={() => setEditando(false)}
          />
        </div>
      )}
    </li>
  );
}
