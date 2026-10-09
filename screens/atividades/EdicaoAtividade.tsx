'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Botao from '@/components/ui/Botao';
import DialogoConfirmacao from '@/components/ui/DialogoConfirmacao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import { CAMPOS_ATIVIDADE } from '@/config/camposFormulario';
import FormularioAtividade from '@/screens/atividades/FormularioAtividade';
import type { ImagensDescricao } from '@/screens/atividades/imagensDescricao';
import { ContextoFechamentoModal } from '@/screens/atividades/ModalRotaAtividade';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import type { ValoresIniciaisAtividade } from '@/screens/atividades/valoresFormularioAtividade';
import type { OpcoesFormularioAtividade } from '@/servidor/atividades/consultasAtividades';
import { editarAtividadeNoDetalhe } from '@/servidor/web/acoes/acoesAtividades';
import type { EstadoFormularioGestao } from '@/types/formulario';
import { serializarFormulario } from '@/util/FormularioUtils';

const ContextoEdicaoAtividade = createContext<(() => void) | null>(null);

function houveAlteracao(
  conteudo: HTMLElement | null,
  instantaneo: string | null,
): boolean {
  const formulario = conteudo?.querySelector('form') ?? null;
  return (
    formulario !== null &&
    instantaneo !== null &&
    serializarFormulario(formulario) !== instantaneo
  );
}

// Fica no cabeçalho do detalhe (renderizado no servidor) e troca o conteúdo
// pelo formulário, sem abrir outra página.
export function BotaoEditarAtividade() {
  const iniciarEdicao = useContext(ContextoEdicaoAtividade);
  if (!iniciarEdicao) {
    return null;
  }
  return <Botao onClick={iniciarEdicao}>{textosAtividades.editar}</Botao>;
}

export type FormularioEdicaoAtividade = {
  valoresIniciais: ValoresIniciaisAtividade;
  opcoes: OpcoesFormularioAtividade;
  credencial: string | null;
  identificacao: { atividadeId: number; versao: number };
  imagensDescricao: ImagensDescricao;
};

type PropriedadesFormularioEdicao = FormularioEdicaoAtividade & {
  aoCancelar: () => void;
  aoSalvar: (mensagem: string) => void;
};

// A trava impede que um segundo envio enfileirado, depois do sucesso, grave
// a mesma edição com a versão já vencida.
function FormularioEdicao({
  valoresIniciais,
  opcoes,
  credencial,
  identificacao,
  imagensDescricao,
  aoCancelar,
  aoSalvar,
}: PropriedadesFormularioEdicao) {
  const concluidoRef = useRef(false);

  async function enviar(
    estado: EstadoFormularioGestao,
    dados: FormData,
  ): Promise<EstadoFormularioGestao> {
    if (concluidoRef.current) {
      return estado;
    }
    const resultado = await editarAtividadeNoDetalhe(estado, dados);
    if (resultado.mensagemSucesso) {
      concluidoRef.current = true;
      aoSalvar(resultado.mensagemSucesso);
    }
    return resultado;
  }

  return (
    <FormularioAtividade
      modo="edicao"
      acao={enviar}
      valoresIniciais={valoresIniciais}
      opcoes={opcoes}
      credencial={credencial}
      identificacao={identificacao}
      imagensDescricao={imagensDescricao}
      aoCancelar={aoCancelar}
    />
  );
}

type PropriedadesEdicaoAtividade = {
  // Id do título do detalhe; na edição, o título do formulário o assume
  // (é ele que dá nome ao modal).
  idTitulo: string;
  formulario: FormularioEdicaoAtividade;
  children: ReactNode;
};

// Sem a versão nova nesse tempo, o detalhe volta assim mesmo e se atualiza
// quando a resposta chegar.
const ESPERA_MAXIMA_ATUALIZACAO_MS = 3000;

// Alterna o detalhe (children, vindo do servidor) e o formulário de edição no
// mesmo lugar: no modal do quadro e na página da atividade. Com alterações não
// salvas, cancelar ou fechar o modal pede confirmação.
export default function EdicaoAtividade({
  idTitulo,
  formulario,
  children,
}: PropriedadesEdicaoAtividade) {
  // Dados do início da edição: atualizações do quadro (tempo real) não mexem
  // no que está sendo digitado, e a versão de partida faz o servidor recusar
  // a gravação por cima de uma alteração feita por outra pessoa.
  const [edicao, setEdicao] = useState<FormularioEdicaoAtividade | null>(null);
  // Versão editada quando a gravação deu certo: o detalhe só volta quando o
  // servidor trouxer a seguinte, para não mostrar por um instante os dados
  // antigos.
  const [salvaSobreVersao, setSalvaSobreVersao] = useState<number | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [descarteAoConfirmar, setDescarteAoConfirmar] = useState<
    (() => void) | null
  >(null);
  const conteudoRef = useRef<HTMLDivElement>(null);
  const instantaneoRef = useRef<string | null>(null);
  const controleModal = useContext(ContextoFechamentoModal);
  const editando = edicao !== null;

  if (
    salvaSobreVersao !== null &&
    formulario.identificacao.versao !== salvaSobreVersao
  ) {
    setSalvaSobreVersao(null);
    setEdicao(null);
  }

  useEffect(() => {
    if (salvaSobreVersao === null) {
      return;
    }
    const espera = window.setTimeout(() => {
      setSalvaSobreVersao(null);
      setEdicao(null);
    }, ESPERA_MAXIMA_ATUALIZACAO_MS);
    return () => window.clearTimeout(espera);
  }, [salvaSobreVersao]);

  useEffect(() => {
    if (!editando) {
      instantaneoRef.current = null;
      return;
    }
    const formularioAberto = conteudoRef.current?.querySelector('form');
    if (!formularioAberto) {
      return;
    }
    instantaneoRef.current = serializarFormulario(formularioAberto);
    const titulo = formularioAberto.elements.namedItem(CAMPOS_ATIVIDADE.TITULO);
    if (titulo instanceof HTMLInputElement) {
      titulo.focus();
    }
  }, [editando]);

  useEffect(() => {
    if (!editando || !controleModal) {
      return;
    }
    controleModal.definirGuarda((fechar) => {
      if (!houveAlteracao(conteudoRef.current, instantaneoRef.current)) {
        return false;
      }
      setDescarteAoConfirmar(() => fechar);
      return true;
    });
    return () => controleModal.definirGuarda(null);
  }, [editando, controleModal]);

  function iniciarEdicao(): void {
    setMensagemSucesso(null);
    setSalvaSobreVersao(null);
    setEdicao(formulario);
  }

  function cancelarEdicao(): void {
    if (houveAlteracao(conteudoRef.current, instantaneoRef.current)) {
      setDescarteAoConfirmar(() => () => setEdicao(null));
      return;
    }
    setEdicao(null);
  }

  function concluirEdicao(mensagem: string): void {
    setMensagemSucesso(mensagem);
    setSalvaSobreVersao(edicao?.identificacao.versao ?? null);
  }

  function confirmarDescarte(): void {
    const continuar = descarteAoConfirmar;
    setDescarteAoConfirmar(null);
    continuar?.();
  }

  return (
    <ContextoEdicaoAtividade.Provider value={iniciarEdicao}>
      {edicao ? (
        <div ref={conteudoRef} className="flex flex-col gap-4">
          <h1 id={idTitulo} className="text-xl font-semibold">
            {textosAtividades.tituloEdicao}
          </h1>
          <FormularioEdicao
            {...edicao}
            aoCancelar={cancelarEdicao}
            aoSalvar={concluirEdicao}
          />
          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              confirmarDescarte();
            }}
          >
            <DialogoConfirmacao
              aberto={descarteAoConfirmar !== null}
              titulo={textosAtividades.tituloDescarteEdicao}
              rotuloConfirmar={textosAtividades.confirmarDescarte}
              rotuloConfirmando={textosAtividades.descartando}
              rotuloCancelar={textosAtividades.continuarEditando}
              pendente={false}
              aoCancelar={() => setDescarteAoConfirmar(null)}
            >
              <p>{textosAtividades.descricaoDescarteEdicao}</p>
            </DialogoConfirmacao>
          </form>
        </div>
      ) : (
        <>
          {mensagemSucesso && (
            <MensagemAlerta tipo="sucesso">{mensagemSucesso}</MensagemAlerta>
          )}
          {children}
        </>
      )}
    </ContextoEdicaoAtividade.Provider>
  );
}
