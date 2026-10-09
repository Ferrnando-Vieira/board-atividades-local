import Link from 'next/link';
import Icone from '@/components/ui/Icone';
import { montarRotaAtividadeNoQuadro } from '@/config/rotas';
import IndicadorPrazo from '@/screens/atividades/IndicadorPrazo';
import IndicadorPrioridade from '@/screens/atividades/IndicadorPrioridade';
import type { PosicaoCartao } from '@/screens/board/movimentosQuadro';
import { textosBoard } from '@/screens/board/textosBoard';
import {
  ATRIBUTOS_ARRASTE,
  type ManipuladoresArrasto,
} from '@/screens/board/useArrastoQuadro';
import type { CartaoQuadro } from '@/servidor/board/consultaQuadro';
import type { ContextoNavegacao } from '@/types/acesso';
import { montarEstiloTag } from '@/util/AparenciaUtils';
import { combinarClasses } from '@/util/ClassesUtils';
import type { MomentoLocal } from '@/util/DataUtils';
import { extrairIniciais } from '@/util/NormalizacaoUtils';
import { calcularSituacaoPrazo, type SituacaoPrazo } from '@/util/PrazoUtils';
import {
  obterNivelPrioridade,
  type NivelPrioridade,
} from '@/util/PrioridadeUtils';

// A alça continua existindo para teclado e leitor de tela; com mouse ou
// toque o cartão inteiro é a área de arraste, então ela só aparece no hover
// ou no foco (e sempre em telas sem hover).
export const CLASSES_ALCA_ARRASTE =
  'inline-flex shrink-0 cursor-grab items-center justify-center rounded-lg text-current opacity-60 transition-opacity select-none hover:bg-current/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primaria active:cursor-grabbing md:opacity-0 md:group-hover/arraste:opacity-70 md:group-focus-within/arraste:opacity-70 [@media(hover:none)]:opacity-70';

// Faixa lateral fina na cor do nível de prioridade (Aparência).
const CLASSES_FAIXA_NIVEL: Record<NivelPrioridade, string> = {
  critica: 'before:bg-(--cor-prioridade-critica)',
  alta: 'before:bg-(--cor-prioridade-alta)',
  media: 'before:bg-(--cor-prioridade-media)',
  baixa: 'before:bg-(--cor-prioridade-baixa)',
};
const CLASSES_DESTAQUE_PRAZO: Partial<Record<SituacaoPrazo, string>> = {
  vencido: 'ring-2 ring-erro/50',
  hoje: 'ring-2 ring-aviso/40',
};
const CLASSES_TAG =
  'inline-flex min-h-6 max-w-full items-center gap-1 rounded-full border px-2 text-xs font-medium transition-[box-shadow,opacity] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primaria';

type PropriedadesCartaoKanban = {
  cartao: CartaoQuadro;
  posicao: PosicaoCartao;
  concluida: boolean;
  momentoLocal: MomentoLocal;
  arrastado: boolean;
  manipuladores: ManipuladoresArrasto;
  idInstrucoes: string;
  contexto: ContextoNavegacao;
  tagsFiltradas: readonly number[];
  aoAlternarTag: (tagId: number) => void;
  aoGerenciarTags: ((atividadeId: number, gatilho: HTMLElement) => void) | null;
};

// Clicar no título abre os detalhes num modal sobre o quadro (rota
// interceptada) e clicar numa tag liga ou desliga o filtro por ela; o
// arraste só começa quando o ponteiro anda (ou, no toque, depois de
// segurar), então cliques continuam sendo cliques.
export default function CartaoKanban({
  cartao,
  posicao,
  concluida,
  momentoLocal,
  arrastado,
  manipuladores,
  idInstrucoes,
  contexto,
  tagsFiltradas,
  aoAlternarTag,
  aoGerenciarTags,
}: PropriedadesCartaoKanban) {
  const atributosCartao = { [ATRIBUTOS_ARRASTE.cartao]: cartao.id };
  const atributosAlca = { [ATRIBUTOS_ARRASTE.alcaCartao]: cartao.id };
  const situacaoPrazo = concluida
    ? null
    : calcularSituacaoPrazo(cartao, momentoLocal);
  const arrastavel = !contexto.somenteLeitura;
  return (
    <li
      {...atributosCartao}
      onPointerDown={
        arrastavel
          ? (evento) =>
              manipuladores.iniciarPonteiroCartao(evento, cartao, posicao)
          : undefined
      }
      onDragStart={(evento) => evento.preventDefault()}
      className={combinarClasses(
        'group/arraste relative flex shrink-0 flex-col gap-2 rounded-xl border border-borda/80 bg-superficie py-2.5 pr-2 pl-4 text-texto shadow-cartao transition-[box-shadow,translate,opacity] [-webkit-touch-callout:none] [text-shadow:none] before:absolute before:inset-y-2.5 before:left-1.5 before:w-1 before:rounded-full hover:shadow-elevado',
        arrastavel &&
          'cursor-grab select-none hover:-translate-y-px active:cursor-grabbing',
        CLASSES_FAIXA_NIVEL[obterNivelPrioridade(cartao.prioridade)],
        situacaoPrazo && CLASSES_DESTAQUE_PRAZO[situacaoPrazo],
        arrastado && 'opacity-40 ring-2 ring-primaria',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={montarRotaAtividadeNoQuadro(cartao.id, contexto.prefixoRotas)}
          draggable={false}
          className="min-w-0 text-sm leading-snug font-medium break-words hover:text-primaria hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
        >
          {cartao.titulo}
        </Link>
        <IndicadorPrioridade prioridade={cartao.prioridade} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-suave">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="grid size-5 shrink-0 place-items-center rounded-full bg-primaria-suave text-[0.625rem] font-semibold text-primaria-escura"
          >
            {extrairIniciais(cartao.solicitante)}
          </span>
          <span className="min-w-0 break-words">
            <span className="sr-only">{textosBoard.rotuloSolicitante} </span>
            {cartao.solicitante}
          </span>
        </span>
        {cartao.prazoData && (
          <span className="inline-flex items-center gap-1">
            <Icone nome="calendario" className="size-3.5" />
            <span className="sr-only">{textosBoard.rotuloPrazo}</span>
            <IndicadorPrazo
              prazoData={cartao.prazoData}
              prazoHora={cartao.prazoHora}
              momentoLocal={momentoLocal}
              concluida={concluida}
              exibirRotulo={false}
            />
          </span>
        )}
        {arrastavel && (
          <button
            type="button"
            {...atributosAlca}
            aria-label={textosBoard.alcaCartao(cartao.titulo)}
            aria-describedby={idInstrucoes}
            className={combinarClasses(
              CLASSES_ALCA_ARRASTE,
              'ml-auto -my-1 size-7',
            )}
            onKeyDown={(evento) =>
              manipuladores.teclarAlcaCartao(evento, cartao, posicao)
            }
            onBlur={manipuladores.sairDaAlca}
          >
            <Icone nome="alca" />
          </button>
        )}
      </div>
      {(cartao.tags.length > 0 || aoGerenciarTags) && (
        <ul className="flex flex-wrap items-center gap-1">
          {cartao.tags.map((tag) => {
            const ativa = tagsFiltradas.includes(tag.id);
            return (
              <li key={tag.id} className="max-w-full">
                <button
                  type="button"
                  aria-pressed={ativa}
                  aria-label={textosBoard.filtros.filtrarPorTag(tag.nome)}
                  onClick={() => aoAlternarTag(tag.id)}
                  style={montarEstiloTag(tag.cor)}
                  className={combinarClasses(
                    CLASSES_TAG,
                    'border-borda bg-fundo text-texto-suave hover:shadow-cartao',
                    ativa && 'ring-2 ring-primaria ring-offset-1',
                  )}
                >
                  {ativa && (
                    <Icone nome="check" className="size-3" espessura={2.5} />
                  )}
                  <span className="truncate">{tag.nome}</span>
                </button>
              </li>
            );
          })}
          {aoGerenciarTags && (
            <li>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={textosBoard.tagsRapidas.abrir(cartao.titulo)}
                title={textosBoard.tagsRapidas.titulo}
                onClick={(evento) =>
                  aoGerenciarTags(cartao.id, evento.currentTarget)
                }
                className={combinarClasses(
                  CLASSES_TAG,
                  'border-dashed border-borda text-texto-suave hover:border-primaria hover:text-primaria',
                  cartao.tags.length > 0 &&
                    'focus-visible:opacity-100 md:opacity-0 md:group-hover/arraste:opacity-100 md:group-focus-within/arraste:opacity-100 [@media(hover:none)]:opacity-100',
                )}
              >
                <Icone nome="mais" className="size-3" espessura={2.5} />
                <Icone nome="tag" className="size-3" />
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}
