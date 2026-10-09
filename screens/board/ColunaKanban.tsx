import { useId, type CSSProperties } from 'react';
import Icone from '@/components/ui/Icone';
import type { SuperficiesBoard } from '@/config/aparenciaBoard';
import CartaoKanban, {
  CLASSES_ALCA_ARRASTE,
} from '@/screens/board/CartaoKanban';
import { intercalarIndicador } from '@/screens/board/movimentosQuadro';
import { textosBoard } from '@/screens/board/textosBoard';
import {
  ATRIBUTOS_ARRASTE,
  type Arrasto,
  type ManipuladoresArrasto,
} from '@/screens/board/useArrastoQuadro';
import type { ColunaQuadro } from '@/servidor/board/consultaQuadro';
import type { ContextoNavegacao } from '@/types/acesso';
import {
  calcularAparenciaColuna,
  montarVariaveisColuna,
} from '@/util/AparenciaUtils';
import { combinarClasses } from '@/util/ClassesUtils';
import type { MomentoLocal } from '@/util/DataUtils';

// Fundo do board e superfícies globais (Aparência): com as cores próprias
// do status, definem cor, transparência e tom do texto de cada coluna.
export type AparenciaQuadro = {
  superficies: SuperficiesBoard;
  amostrasFundo: readonly string[];
};

type PropriedadesColunaKanban = {
  coluna: ColunaQuadro;
  indice: number;
  momentoLocal: MomentoLocal;
  aparencia: AparenciaQuadro;
  arrasto: Arrasto | null;
  manipuladores: ManipuladoresArrasto;
  idInstrucoes: string;
  contexto: ContextoNavegacao;
  filtrada: boolean;
  tagsFiltradas: readonly number[];
  aoAlternarTag: (tagId: number) => void;
  aoGerenciarTags: ((atividadeId: number, gatilho: HTMLElement) => void) | null;
};

function IndicadorDestinoCartao() {
  return (
    <li
      aria-hidden="true"
      className="flex h-12 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-primaria/70 bg-primaria/10 text-xs font-semibold text-primaria-escura [text-shadow:none]"
    >
      {textosBoard.destinoArraste}
    </li>
  );
}

type PropriedadesAlcaColuna = {
  coluna: ColunaQuadro;
  indice: number;
  manipuladores: ManipuladoresArrasto;
  idInstrucoes: string;
};

// Só teclado e leitor de tela: com ponteiro, o cabeçalho inteiro arrasta.
function AlcaColuna({
  coluna,
  indice,
  manipuladores,
  idInstrucoes,
}: PropriedadesAlcaColuna) {
  const atributosAlca = { [ATRIBUTOS_ARRASTE.alcaColuna]: coluna.id };
  return (
    <button
      type="button"
      {...atributosAlca}
      aria-label={textosBoard.alcaColuna(coluna.nome)}
      aria-describedby={idInstrucoes}
      className={combinarClasses(CLASSES_ALCA_ARRASTE, 'size-8')}
      onKeyDown={(evento) =>
        manipuladores.teclarAlcaColuna(evento, coluna, indice)
      }
      onBlur={manipuladores.sairDaAlca}
    >
      <Icone nome="alca" />
    </button>
  );
}

// Título e corpo são superfícies separadas, cada uma com cor, opacidade e
// tom de texto calculados pelo contraste com o que está atrás delas.
export default function ColunaKanban({
  coluna,
  indice,
  momentoLocal,
  aparencia,
  arrasto,
  manipuladores,
  idInstrucoes,
  contexto,
  filtrada,
  tagsFiltradas,
  aoAlternarTag,
  aoGerenciarTags,
}: PropriedadesColunaKanban) {
  const idTitulo = useId();
  const idCartaoArrastado =
    arrasto?.tipo === 'cartao' ? arrasto.atividadeId : null;
  const indiceIndicador =
    arrasto?.tipo === 'cartao' && arrasto.alvo.statusId === coluna.id
      ? arrasto.alvo.indice
      : null;
  const colunaArrastada =
    arrasto?.tipo === 'coluna' && arrasto.statusId === coluna.id;
  const elementos = intercalarIndicador(
    coluna.atividades,
    (cartao) => cartao.id === idCartaoArrastado,
    indiceIndicador,
  );
  const atributosColuna = { [ATRIBUTOS_ARRASTE.coluna]: coluna.id };
  const atributosLista = { [ATRIBUTOS_ARRASTE.listaColuna]: coluna.id };
  const visual = calcularAparenciaColuna(
    aparencia.amostrasFundo,
    aparencia.superficies,
    coluna,
  );
  const arrastavel = !contexto.somenteLeitura;
  const vazia = coluna.atividades.length === 0 && indiceIndicador === null;

  return (
    <section
      {...atributosColuna}
      aria-labelledby={idTitulo}
      data-tom={visual.coluna.tom}
      style={montarVariaveisColuna(visual) as CSSProperties}
      className={combinarClasses(
        'superficie-coluna contorno-superficie flex w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-2xl border shadow-cartao transition-opacity sm:w-76 md:max-h-full md:w-auto md:max-w-none md:min-w-72 md:flex-1 md:basis-0',
        colunaArrastada && 'opacity-40 ring-2 ring-primaria',
      )}
    >
      <header
        data-tom={visual.titulo.tom}
        onPointerDown={
          arrastavel
            ? (evento) =>
                manipuladores.iniciarPonteiroColuna(evento, coluna, indice)
            : undefined
        }
        className={combinarClasses(
          'group/arraste superficie-titulo m-1.5 mb-0 flex min-h-11 items-center gap-2 rounded-xl px-3 [-webkit-touch-callout:none]',
          arrastavel && 'cursor-grab select-none active:cursor-grabbing',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <h2
            id={idTitulo}
            className="text-sm font-semibold tracking-tight break-words"
          >
            {coluna.nome}
          </h2>
          <span
            title={textosBoard.descreverQuantidade(coluna.atividades.length)}
            className="min-w-6 rounded-full bg-current/10 px-1.5 text-center text-xs font-semibold tabular-nums"
          >
            <span aria-hidden="true">{coluna.atividades.length}</span>
            <span className="sr-only">
              {textosBoard.descreverQuantidade(coluna.atividades.length)}
            </span>
          </span>
          {coluna.finalizaAtividade && (
            <span
              title={textosBoard.descricaoConclui}
              className="inline-flex items-center gap-1 rounded-full bg-sucesso-fundo px-2 text-xs font-medium text-sucesso [text-shadow:none]"
            >
              <Icone nome="conclui" className="size-3.5" />
              {textosBoard.concluiAtividade}
            </span>
          )}
        </div>
        {arrastavel && (
          <AlcaColuna
            coluna={coluna}
            indice={indice}
            manipuladores={manipuladores}
            idInstrucoes={idInstrucoes}
          />
        )}
      </header>
      <ol
        {...atributosLista}
        aria-label={textosBoard.listaDaColuna(coluna.nome)}
        className={combinarClasses(
          'rolagem-fina flex flex-col gap-2 md:min-h-0 md:overflow-y-auto',
          vazia ? 'p-0' : 'min-h-24 flex-1 p-1.5',
        )}
      >
        {elementos.map((elemento) =>
          elemento.tipo === 'indicador' ? (
            <IndicadorDestinoCartao key="indicador-destino" />
          ) : (
            <CartaoKanban
              key={elemento.item.id}
              cartao={elemento.item}
              posicao={{ statusId: coluna.id, indice: elemento.indice }}
              concluida={coluna.finalizaAtividade}
              momentoLocal={momentoLocal}
              arrastado={elemento.item.id === idCartaoArrastado}
              manipuladores={manipuladores}
              idInstrucoes={idInstrucoes}
              contexto={contexto}
              tagsFiltradas={tagsFiltradas}
              aoAlternarTag={aoAlternarTag}
              aoGerenciarTags={aoGerenciarTags}
            />
          ),
        )}
      </ol>
      {vazia && (
        <p className="texto-superficie-suave mx-1.5 mb-1.5 flex min-h-20 items-center justify-center rounded-xl border border-dashed border-current/25 px-3 text-center text-xs">
          {filtrada ? textosBoard.colunaVaziaFiltrada : textosBoard.colunaVazia}
        </p>
      )}
    </section>
  );
}
