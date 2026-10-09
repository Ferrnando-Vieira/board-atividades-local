'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import Icone from '@/components/ui/Icone';
import { textosAtividades } from '@/screens/atividades/textosAtividades';
import {
  possuiFiltrosAtivos,
  type CategoriaFiltro,
  type FiltrosQuadro,
  type OpcaoFiltro,
  type OpcoesFiltroQuadro,
} from '@/screens/board/filtrosQuadro';
import { textosBoard } from '@/screens/board/textosBoard';
import { montarEstiloTag } from '@/util/AparenciaUtils';
import { combinarClasses } from '@/util/ClassesUtils';

const textos = textosBoard.filtros;
const TECLA_ESCAPE = 'Escape';

const CLASSES_OPCAO =
  'inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-[box-shadow,background-color] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primaria';

const CLASSES_OPCAO_MARCADA = 'ring-2 ring-primaria ring-offset-1';
const CLASSES_OPCAO_LIVRE =
  'border-borda bg-superficie text-texto hover:border-texto-suave/50 hover:bg-fundo';

type FiltroAtivo = {
  chave: string;
  categoria: CategoriaFiltro;
  valor: number;
  rotulo: string;
  descricao: string;
};

type PropriedadesBarraFiltros = {
  filtros: FiltrosQuadro;
  opcoes: OpcoesFiltroQuadro;
  totalVisivel: number;
  total: number;
  aoAlternar: (categoria: CategoriaFiltro, valor: number) => void;
  aoLimpar: () => void;
};

function nomeDaOpcao(opcoes: readonly OpcaoFiltro[], id: number): string {
  return opcoes.find((opcao) => opcao.id === id)?.nome ?? '';
}

function listarFiltrosAtivos(
  filtros: FiltrosQuadro,
  opcoes: OpcoesFiltroQuadro,
): FiltroAtivo[] {
  return [
    ...filtros.prioridades.map((prioridade) => ({
      chave: `prioridade-${prioridade}`,
      categoria: 'prioridades' as const,
      valor: prioridade,
      rotulo: textosAtividades.rotuloPrioridadeCurto(prioridade),
      descricao: textos.descreverPrioridade(prioridade),
    })),
    ...filtros.tagIds.map((id) => {
      const nome = nomeDaOpcao(opcoes.tags, id);
      return {
        chave: `tag-${id}`,
        categoria: 'tagIds' as const,
        valor: id,
        rotulo: nome,
        descricao: textos.descreverTag(nome),
      };
    }),
    ...filtros.solicitanteIds.map((id) => {
      const nome = nomeDaOpcao(opcoes.solicitantes, id);
      return {
        chave: `solicitante-${id}`,
        categoria: 'solicitanteIds' as const,
        valor: id,
        rotulo: nome,
        descricao: textos.descreverSolicitante(nome),
      };
    }),
  ];
}

type OpcaoGrupo = {
  valor: number;
  rotulo: string;
  titulo?: string;
  estilo?: CSSProperties;
};

type PropriedadesGrupoOpcoes = {
  legenda: string;
  vazio: string;
  opcoes: readonly OpcaoGrupo[];
  marcados: readonly number[];
  aoAlternar: (valor: number) => void;
};

function GrupoOpcoes({
  legenda,
  vazio,
  opcoes,
  marcados,
  aoAlternar,
}: PropriedadesGrupoOpcoes) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-xs font-semibold tracking-wide text-texto-suave uppercase">
        {legenda}
      </legend>
      {opcoes.length === 0 ? (
        <p className="text-xs text-texto-suave">{vazio}</p>
      ) : (
        <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto p-1">
          {opcoes.map((opcao) => {
            const marcado = marcados.includes(opcao.valor);
            return (
              <button
                key={opcao.valor}
                type="button"
                aria-pressed={marcado}
                title={opcao.titulo}
                onClick={() => aoAlternar(opcao.valor)}
                style={opcao.estilo}
                className={combinarClasses(
                  CLASSES_OPCAO,
                  CLASSES_OPCAO_LIVRE,
                  marcado && CLASSES_OPCAO_MARCADA,
                )}
              >
                {marcado && (
                  <Icone nome="check" className="size-3" espessura={2.5} />
                )}
                {opcao.rotulo}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

// O botão mostra quantos filtros estão ligados e abre o painel por cima do
// quadro (sem empurrar as colunas); os chips ao lado desligam cada filtro
// sem abrir o painel.
export default function BarraFiltros({
  filtros,
  opcoes,
  totalVisivel,
  total,
  aoAlternar,
  aoLimpar,
}: PropriedadesBarraFiltros) {
  const [expandida, setExpandida] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const idPainel = useId();
  const ativos = listarFiltrosAtivos(filtros, opcoes);
  const comFiltro = possuiFiltrosAtivos(filtros);

  useEffect(() => {
    if (!expandida) {
      return;
    }
    function fecharAoClicarFora(evento: PointerEvent): void {
      if (!raizRef.current?.contains(evento.target as Node)) {
        setExpandida(false);
      }
    }
    document.addEventListener('pointerdown', fecharAoClicarFora);
    return () =>
      document.removeEventListener('pointerdown', fecharAoClicarFora);
  }, [expandida]);

  function fecharComTeclado(evento: KeyboardEvent<HTMLDivElement>): void {
    if (evento.key === TECLA_ESCAPE && expandida) {
      evento.stopPropagation();
      setExpandida(false);
      botaoRef.current?.focus();
    }
  }

  return (
    <div
      ref={raizRef}
      onKeyDown={fecharComTeclado}
      className="relative flex flex-wrap items-center gap-2"
    >
      <button
        ref={botaoRef}
        type="button"
        aria-expanded={expandida}
        aria-controls={idPainel}
        onClick={() => setExpandida(!expandida)}
        className={combinarClasses(
          'inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold shadow-cartao transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria',
          comFiltro
            ? 'border-primaria bg-primaria-suave text-primaria-escura'
            : 'border-borda bg-superficie text-texto hover:bg-fundo',
        )}
      >
        <Icone nome="filtro" />
        {textos.botao}
        {comFiltro && (
          <span className="min-w-5 rounded-full bg-primaria px-1.5 text-xs text-white tabular-nums">
            {ativos.length}
          </span>
        )}
        <Icone
          nome="setaBaixo"
          className={combinarClasses(
            'size-3.5 transition-transform',
            expandida && 'rotate-180',
          )}
        />
      </button>
      {comFiltro && (
        <>
          <ul
            aria-label={textos.rotuloAtivos}
            className="flex flex-wrap items-center gap-1.5"
          >
            {ativos.map((ativo) => (
              <li key={ativo.chave}>
                <button
                  type="button"
                  onClick={() => aoAlternar(ativo.categoria, ativo.valor)}
                  aria-label={textos.removerFiltro(ativo.descricao)}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-primaria/40 bg-primaria-suave py-0.5 pr-1.5 pl-3 text-xs font-medium text-primaria-escura [text-shadow:none] hover:bg-primaria/20 focus-visible:outline-2 focus-visible:outline-primaria"
                >
                  <span className="max-w-40 truncate">{ativo.rotulo}</span>
                  <Icone nome="fechar" className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={aoLimpar}
            className="texto-superficie-suave min-h-8 rounded-md px-2 text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primaria"
          >
            {textos.limpar}
          </button>
          <p role="status" className="texto-superficie-suave text-xs">
            {textos.descreverResultado(totalVisivel, total)}
          </p>
        </>
      )}
      <div
        id={idPainel}
        role="region"
        aria-label={textos.rotuloRegiao}
        hidden={!expandida}
        className={combinarClasses(
          'absolute top-full left-0 z-40 mt-2 w-[min(46rem,calc(100vw-2rem))] animate-surgir grid-cols-1 gap-4 rounded-2xl border border-borda bg-superficie p-4 text-texto shadow-flutuante [text-shadow:none] md:grid-cols-3',
          expandida ? 'grid' : 'hidden',
        )}
      >
        <GrupoOpcoes
          legenda={textos.legendaPrioridades}
          vazio=""
          opcoes={opcoes.prioridades.map((prioridade) => ({
            valor: prioridade,
            rotulo: textosAtividades.rotuloPrioridadeCurto(prioridade),
            titulo: textosAtividades.descreverPrioridade(prioridade),
          }))}
          marcados={filtros.prioridades}
          aoAlternar={(valor) => aoAlternar('prioridades', valor)}
        />
        <GrupoOpcoes
          legenda={textos.legendaTags}
          vazio={textos.semTags}
          opcoes={opcoes.tags.map((tag) => ({
            valor: tag.id,
            rotulo: tag.nome,
            estilo: montarEstiloTag(tag.cor),
          }))}
          marcados={filtros.tagIds}
          aoAlternar={(valor) => aoAlternar('tagIds', valor)}
        />
        <GrupoOpcoes
          legenda={textos.legendaSolicitantes}
          vazio={textos.semSolicitantes}
          opcoes={opcoes.solicitantes.map((solicitante) => ({
            valor: solicitante.id,
            rotulo: solicitante.nome,
          }))}
          marcados={filtros.solicitanteIds}
          aoAlternar={(valor) => aoAlternar('solicitanteIds', valor)}
        />
        <p className="text-xs text-texto-suave md:col-span-3">{textos.dica}</p>
      </div>
    </div>
  );
}
