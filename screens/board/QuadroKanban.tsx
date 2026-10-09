'use client';

import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import Botao from '@/components/ui/Botao';
import Icone from '@/components/ui/Icone';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import IndicadorPrioridade from '@/screens/atividades/IndicadorPrioridade';
import BarraFiltros from '@/screens/board/BarraFiltros';
import ColunaKanban, {
  type AparenciaQuadro,
} from '@/screens/board/ColunaKanban';
import {
  alternarFiltro,
  extrairOpcoesFiltro,
  FILTROS_VAZIOS,
  filtrarColunas,
  manterOpcoesDisponiveis,
  possuiFiltrosAtivos,
  type CategoriaFiltro,
} from '@/screens/board/filtrosQuadro';
import GerenciadorTagsCartao from '@/screens/board/GerenciadorTagsCartao';
import ModalNovaAtividade from '@/screens/board/ModalNovaAtividade';
import {
  aplicarMovimento,
  intercalarIndicador,
  localizarCartao,
  montarCargaMovimentoCartao,
  montarCargaReordenacao,
  type MovimentoQuadro,
} from '@/screens/board/movimentosQuadro';
import { textosBoard } from '@/screens/board/textosBoard';
import { useArrastoQuadro } from '@/screens/board/useArrastoQuadro';
import { useFiltrosQuadro } from '@/screens/board/useFiltrosQuadro';
import type { OpcoesFormularioAtividade } from '@/servidor/atividades/consultasAtividades';
import {
  CODIGO_CONFLITO_ORDEM,
  CODIGO_CONFLITO_VERSAO,
} from '@/servidor/banco/concorrencia';
import type {
  ColunaQuadro,
  QuadroAtividades,
} from '@/servidor/board/consultaQuadro';
import { moverAtividadeNoQuadro } from '@/servidor/web/acoes/acoesAtividades';
import { reordenarStatusNoQuadro } from '@/servidor/web/acoes/acoesStatus';
import type { ContextoNavegacao } from '@/types/acesso';
import type { ResultadoAcao } from '@/types/acoes';
import { calcularAparenciaColuna } from '@/util/AparenciaUtils';
import { combinarClasses } from '@/util/ClassesUtils';

const CODIGOS_CONFLITO = new Set([
  CODIGO_CONFLITO_ORDEM,
  CODIGO_CONFLITO_VERSAO,
]);

const TECLA_BUSCA = '/';
const TECLA_NOVA_ATIVIDADE = 'n';
const SELETOR_CAMPO_BUSCA = '[data-busca-quadro]';
const SELETOR_CAMPO_EDITAVEL =
  'input, textarea, select, [contenteditable="true"], dialog[open]';

type PropriedadesQuadroKanban = {
  quadro: QuadroAtividades;
  contexto: ContextoNavegacao;
  aparencia: AparenciaQuadro;
  // Só existe quando o acesso pode criar e editar (painel ou link completo).
  opcoesFormulario: OpcoesFormularioAtividade | null;
  acoesCabecalho?: ReactNode;
};

type GerenciamentoTags = {
  atividadeId: number;
  gatilho: HTMLElement;
};

function enviarMovimento(
  colunas: readonly ColunaQuadro[],
  movimento: MovimentoQuadro,
  credencial: string | null,
): Promise<ResultadoAcao> | null {
  if (movimento.tipo === 'coluna') {
    return reordenarStatusNoQuadro(
      montarCargaReordenacao(colunas, movimento),
      credencial,
    );
  }
  const carga = montarCargaMovimentoCartao(colunas, movimento);
  return carga ? moverAtividadeNoQuadro(carga, credencial) : null;
}

function descreverFalha(resultado: ResultadoAcao): string | null {
  if (resultado.ok) {
    return null;
  }
  return CODIGOS_CONFLITO.has(resultado.codigo)
    ? textosBoard.conflitoMovimento
    : `${textosBoard.falhaMovimento} ${resultado.mensagem}`;
}

function contarCartoes(colunas: readonly ColunaQuadro[]): number {
  return colunas.reduce((total, coluna) => total + coluna.atividades.length, 0);
}

function IndicadorDestinoColuna() {
  return (
    <div
      aria-hidden="true"
      className="w-2 shrink-0 self-stretch rounded-full bg-primaria shadow-elevado"
    />
  );
}

// Atalhos só valem fora de campos e diálogos, para não roubar digitação.
function ehAlvoDeDigitacao(alvo: EventTarget | null): boolean {
  return (
    alvo instanceof Element && alvo.closest(SELETOR_CAMPO_EDITAVEL) !== null
  );
}

// O movimento aparece na hora (useOptimistic) e é gravado na mesma ação; a
// resposta já traz o quadro revalidado, que substitui o estado otimista. Os
// filtros só escondem cartões na tela: o otimista e as cargas usam o quadro
// inteiro. No modo somente leitura não há alças nem atalhos de criação.
export default function QuadroKanban({
  quadro,
  contexto,
  aparencia,
  opcoesFormulario,
  acoesCabecalho,
}: PropriedadesQuadroKanban) {
  const [colunas, aplicarOtimista] = useOptimistic(
    quadro.colunas,
    aplicarMovimento,
  );
  const [salvando, iniciarTransicao] = useTransition();
  const [falha, setFalha] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [anuncio, setAnuncio] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [gerenciamentoTags, setGerenciamentoTags] =
    useState<GerenciamentoTags | null>(null);
  const idInstrucoes = useId();
  const opcoesEdicao = contexto.somenteLeitura ? null : opcoesFormulario;
  const editavel = opcoesEdicao !== null;

  const { filtros: filtrosSalvos, definirFiltros } = useFiltrosQuadro(
    contexto.prefixoRotas,
  );
  const opcoesFiltro = useMemo(() => extrairOpcoesFiltro(colunas), [colunas]);
  const filtros = useMemo(
    () => manterOpcoesDisponiveis(filtrosSalvos, opcoesFiltro),
    [filtrosSalvos, opcoesFiltro],
  );
  const colunasVisiveis = useMemo(
    () => filtrarColunas(colunas, filtros),
    [colunas, filtros],
  );
  const comFiltro = possuiFiltrosAtivos(filtros);
  const cartaoGerenciado = gerenciamentoTags
    ? localizarCartao(colunas, gerenciamentoTags.atividadeId)?.cartao
    : undefined;

  function soltar(movimento: MovimentoQuadro): void {
    if (!editavel) {
      return;
    }
    setFalha(null);
    iniciarTransicao(async () => {
      const envio = enviarMovimento(
        colunas,
        movimento,
        contexto.tokenCompartilhamento,
      );
      if (!envio) {
        return;
      }
      aplicarOtimista(movimento);
      const resultado = await envio;
      setFalha(descreverFalha(resultado));
      setMensagem(resultado.ok ? textosBoard.salvo : '');
    });
  }

  function alternar(categoria: CategoriaFiltro, valor: number): void {
    definirFiltros(alternarFiltro(filtros, categoria, valor));
  }

  function concluirCriacao(texto: string): void {
    setModalAberto(false);
    setFalha(null);
    setMensagem(comFiltro ? `${texto} ${textosBoard.criadaOculta}` : texto);
  }

  const { arrasto, quadroRef, fantasmaRef, manipuladores } = useArrastoQuadro({
    colunas: colunasVisiveis,
    aoSoltar: soltar,
    aoAnunciar: setAnuncio,
  });
  const elementos = intercalarIndicador(
    colunasVisiveis,
    (coluna) => arrasto?.tipo === 'coluna' && arrasto.statusId === coluna.id,
    arrasto?.tipo === 'coluna' ? arrasto.alvo : null,
  );
  const aoGerenciarTags = editavel
    ? (atividadeId: number, gatilho: HTMLElement) =>
        setGerenciamentoTags({ atividadeId, gatilho })
    : null;
  const totalVisivel = contarCartoes(colunasVisiveis);
  const tomFerramentas = calcularAparenciaColuna(
    aparencia.amostrasFundo,
    aparencia.superficies,
  ).coluna.tom;

  const tratarAtalho = useEffectEvent((evento: KeyboardEvent) => {
    if (
      evento.ctrlKey ||
      evento.metaKey ||
      evento.altKey ||
      ehAlvoDeDigitacao(evento.target)
    ) {
      return;
    }
    if (evento.key === TECLA_BUSCA) {
      const campo =
        document.querySelector<HTMLInputElement>(SELETOR_CAMPO_BUSCA);
      if (campo) {
        evento.preventDefault();
        campo.focus();
      }
    } else if (evento.key === TECLA_NOVA_ATIVIDADE && editavel) {
      evento.preventDefault();
      setModalAberto(true);
    }
  });

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent): void {
      tratarAtalho(evento);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  return (
    <div className="flex flex-col gap-3 md:min-h-0 md:flex-1">
      <section
        aria-label={textosBoard.rotuloFerramentas}
        data-tom={tomFerramentas}
        className="superficie-coluna contorno-superficie relative z-20 flex flex-col gap-2 rounded-2xl border p-2 shadow-cartao"
      >
        <div className="flex flex-wrap items-center gap-2">
          {editavel ? (
            <Botao
              onClick={() => setModalAberto(true)}
              aria-keyshortcuts={TECLA_NOVA_ATIVIDADE}
              title={textosBoard.atalhoNovaAtividade}
              className="w-auto"
            >
              <Icone nome="mais" espessura={2.4} />
              {textosBoard.novaAtividade}
            </Botao>
          ) : (
            <p className="texto-superficie-suave inline-flex items-center gap-2 px-2 text-xs">
              <Icone nome="olho" />
              {textosBoard.descricaoSomenteLeitura}
            </p>
          )}
          <BarraFiltros
            filtros={filtros}
            opcoes={opcoesFiltro}
            totalVisivel={totalVisivel}
            total={contarCartoes(colunas)}
            aoAlternar={alternar}
            aoLimpar={() => definirFiltros(FILTROS_VAZIOS)}
          />
          <p
            role="status"
            className="texto-superficie-suave inline-flex min-h-6 items-center gap-1.5 px-1 text-xs"
          >
            {salvando && (
              <span
                aria-hidden="true"
                className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            )}
            {salvando ? textosBoard.salvando : falha ? '' : mensagem}
          </p>
          {acoesCabecalho && (
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              {acoesCabecalho}
            </div>
          )}
        </div>
      </section>
      {!contexto.somenteLeitura && (
        <p id={idInstrucoes} className="sr-only">
          {textosBoard.instrucoesArraste}
        </p>
      )}
      <p aria-live="assertive" className="sr-only">
        {anuncio}
      </p>
      {falha && (
        <MensagemAlerta tipo="erro">
          <div className="flex items-start justify-between gap-3">
            <span>{falha}</span>
            <button
              type="button"
              onClick={() => setFalha(null)}
              aria-label={textosBoard.fecharAviso}
              className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-erro/10 focus-visible:outline-2 focus-visible:outline-primaria"
            >
              <Icone nome="fechar" />
            </button>
          </div>
        </MensagemAlerta>
      )}
      {comFiltro && totalVisivel === 0 && (
        <div
          data-tom={tomFerramentas}
          className="superficie-coluna contorno-superficie flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-cartao"
        >
          <span className="inline-flex items-center gap-2">
            <Icone nome="filtro" />
            {textosBoard.filtrosSemResultado}
          </span>
          <Botao
            variante="secundario"
            className="w-auto"
            onClick={() => definirFiltros(FILTROS_VAZIOS)}
          >
            {textosBoard.filtros.limpar}
          </Botao>
        </div>
      )}
      <div
        ref={quadroRef}
        className={combinarClasses(
          'rolagem-fina -mx-1 flex items-stretch gap-3 overflow-x-auto px-1 pb-3 md:min-h-0 md:flex-1 md:items-start',
          arrasto ? 'snap-none' : 'snap-x snap-mandatory md:snap-none',
          arrasto?.modo === 'ponteiro' && 'cursor-grabbing select-none',
        )}
      >
        {elementos.map((elemento) =>
          elemento.tipo === 'indicador' ? (
            <IndicadorDestinoColuna key="indicador-coluna" />
          ) : (
            <ColunaKanban
              key={elemento.item.id}
              coluna={elemento.item}
              indice={elemento.indice}
              momentoLocal={quadro.momentoLocal}
              aparencia={aparencia}
              arrasto={arrasto}
              manipuladores={manipuladores}
              idInstrucoes={idInstrucoes}
              contexto={contexto}
              filtrada={comFiltro}
              tagsFiltradas={filtros.tagIds}
              aoAlternarTag={(tagId) => alternar('tagIds', tagId)}
              aoGerenciarTags={aoGerenciarTags}
            />
          ),
        )}
      </div>
      {arrasto?.fantasma && (
        <div
          ref={fantasmaRef}
          aria-hidden="true"
          className="pointer-events-none fixed top-0 left-0 z-50"
          style={{
            width: arrasto.fantasma.largura,
            transform: `translate3d(${arrasto.fantasma.x}px, ${arrasto.fantasma.y}px, 0)`,
          }}
        >
          <div className="flex rotate-2 items-start justify-between gap-2 rounded-xl border-2 border-primaria bg-superficie p-3 text-sm font-medium break-words text-texto shadow-flutuante motion-reduce:rotate-0">
            <span className="min-w-0">
              {arrasto.tipo === 'cartao' ? arrasto.titulo : arrasto.nome}
            </span>
            {arrasto.tipo === 'cartao' && (
              <IndicadorPrioridade prioridade={arrasto.prioridade} />
            )}
          </div>
        </div>
      )}
      {opcoesEdicao && (
        <ModalNovaAtividade
          aberto={modalAberto}
          opcoes={opcoesEdicao}
          credencial={contexto.tokenCompartilhamento}
          aoFechar={() => setModalAberto(false)}
          aoCriar={concluirCriacao}
        />
      )}
      {opcoesEdicao && gerenciamentoTags && cartaoGerenciado && (
        <GerenciadorTagsCartao
          key={gerenciamentoTags.atividadeId}
          cartao={cartaoGerenciado}
          gatilho={gerenciamentoTags.gatilho}
          tagsDisponiveis={opcoesEdicao.tags}
          credencial={contexto.tokenCompartilhamento}
          aoFechar={() => setGerenciamentoTags(null)}
        />
      )}
    </div>
  );
}
