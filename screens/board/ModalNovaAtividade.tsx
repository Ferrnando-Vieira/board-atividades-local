'use client';

import { useEffect, useRef, useState } from 'react';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import DialogoModal from '@/components/ui/DialogoModal';
import { CAMPOS_ATIVIDADE } from '@/config/camposFormulario';
import FormularioAtividade from '@/screens/atividades/FormularioAtividade';
import { montarValoresNovaAtividade } from '@/screens/atividades/valoresFormularioAtividade';
import { textosBoard } from '@/screens/board/textosBoard';
import type { OpcoesFormularioAtividade } from '@/servidor/atividades/consultasAtividades';
import { criarAtividadeNoQuadro } from '@/servidor/web/acoes/acoesAtividades';
import type { EstadoFormularioGestao } from '@/types/formulario';
import { serializarFormulario } from '@/util/FormularioUtils';

type PropriedadesModalNovaAtividade = {
  aberto: boolean;
  opcoes: OpcoesFormularioAtividade;
  credencial: string | null;
  aoFechar: () => void;
  aoCriar: (mensagem: string) => void;
};

type PropriedadesFormularioNovaAtividade = {
  opcoes: OpcoesFormularioAtividade;
  credencial: string | null;
  aoCancelar: () => void;
  aoCriar: (mensagem: string) => void;
};

// Uma instância por rascunho (a chave muda a cada criação ou descarte). A
// trava impede que um segundo envio enfileirado, depois do sucesso, crie a
// mesma atividade de novo.
function FormularioNovaAtividade({
  opcoes,
  credencial,
  aoCancelar,
  aoCriar,
}: PropriedadesFormularioNovaAtividade) {
  const concluidoRef = useRef(false);
  const statusInicial = opcoes.status[0];

  async function enviar(
    estado: EstadoFormularioGestao,
    dados: FormData,
  ): Promise<EstadoFormularioGestao> {
    if (concluidoRef.current) {
      return estado;
    }
    const resultado = await criarAtividadeNoQuadro(estado, dados);
    if (resultado.mensagemSucesso) {
      concluidoRef.current = true;
      aoCriar(resultado.mensagemSucesso);
    }
    return resultado;
  }

  if (!statusInicial) {
    return null;
  }
  return (
    <FormularioAtividade
      modo="criacao"
      acao={enviar}
      valoresIniciais={montarValoresNovaAtividade(
        statusInicial.id,
        opcoes.solicitantePadrao,
      )}
      opcoes={opcoes}
      aoCancelar={aoCancelar}
      credencial={credencial}
    />
  );
}

// O formulário fica montado com o modal fechado: se o navegador fechar o
// diálogo por conta própria, o rascunho continua lá na próxima abertura.
// Fechar pelo Esc, pelo X ou por Cancelar com algo preenchido pede
// confirmação antes de descartar.
export default function ModalNovaAtividade({
  aberto,
  opcoes,
  credencial,
  aoFechar,
  aoCriar,
}: PropriedadesModalNovaAtividade) {
  const [versaoRascunho, setVersaoRascunho] = useState(0);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const instantaneoRef = useRef<string | null>(null);

  function obterFormulario(): HTMLFormElement | null {
    return conteudoRef.current?.querySelector('form') ?? null;
  }

  // Roda depois do showModal (efeitos dos filhos vêm antes): o foco vai para
  // o título e a fotografia inicial é tirada uma vez por rascunho.
  useEffect(() => {
    if (!aberto) {
      return;
    }
    const formulario = conteudoRef.current?.querySelector('form');
    if (formulario && instantaneoRef.current === null) {
      instantaneoRef.current = serializarFormulario(formulario);
    }
    const titulo = formulario?.elements.namedItem(CAMPOS_ATIVIDADE.TITULO);
    if (titulo instanceof HTMLInputElement) {
      titulo.focus();
    }
  }, [aberto, versaoRascunho]);

  function reiniciarRascunho(): void {
    instantaneoRef.current = null;
    setVersaoRascunho((versao) => versao + 1);
  }

  function descartar(): void {
    setConfirmandoDescarte(false);
    reiniciarRascunho();
    aoFechar();
  }

  function solicitarFechamento(): void {
    const formulario = obterFormulario();
    const alterado =
      formulario !== null &&
      instantaneoRef.current !== null &&
      serializarFormulario(formulario) !== instantaneoRef.current;
    if (alterado) {
      setConfirmandoDescarte(true);
      return;
    }
    descartar();
  }

  function concluirCriacao(mensagem: string): void {
    reiniciarRascunho();
    aoCriar(mensagem);
  }

  return (
    <DialogoModal
      aberto={aberto}
      titulo={textosBoard.tituloModalNova}
      rotuloFechar={textosBoard.fecharModal}
      aoFechar={aoFechar}
      aoSolicitarFechamento={solicitarFechamento}
    >
      <p className="-mt-2 text-sm text-texto-suave">
        {textosBoard.descricaoModalNova}
      </p>
      <div ref={conteudoRef}>
        <FormularioNovaAtividade
          key={versaoRascunho}
          opcoes={opcoes}
          credencial={credencial}
          aoCancelar={solicitarFechamento}
          aoCriar={concluirCriacao}
        />
      </div>
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          descartar();
        }}
      >
        <DialogoConfirmacao
          aberto={confirmandoDescarte}
          titulo={textosBoard.tituloDescarte}
          rotuloConfirmar={textosBoard.confirmarDescarte}
          rotuloConfirmando={textosBoard.descartando}
          rotuloCancelar={textosBoard.continuarEditando}
          pendente={false}
          aoCancelar={() => setConfirmandoDescarte(false)}
        >
          <p>{textosBoard.descricaoDescarte}</p>
        </DialogoConfirmacao>
      </form>
    </DialogoModal>
  );
}
