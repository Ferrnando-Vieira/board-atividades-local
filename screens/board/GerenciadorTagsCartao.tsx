'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ToggleEvent,
} from 'react';
import { LIMITES_COLECAO, LIMITES_TEXTO } from '@/config/constantes';
import { textosBoard } from '@/screens/board/textosBoard';
import type { CartaoQuadro } from '@/servidor/board/consultaQuadro';
import {
  adicionarTagNoQuadro,
  removerTagNoQuadro,
} from '@/servidor/web/acoes/acoesAtividades';
import type { ResultadoAcao } from '@/types/acoes';
import {
  gerarChaveNormalizada,
  normalizarNomeExibicao,
} from '@/util/NormalizacaoUtils';

const textos = textosBoard.tagsRapidas;

const LARGURA_POPOVER_PX = 288;
const MARGEM_JANELA_PX = 8;
const AFASTAMENTO_GATILHO_PX = 4;
const ESPACO_MINIMO_ABAIXO_PX = 240;
const MAXIMO_SUGESTOES = 8;
const TECLA_CONFIRMAR = 'Enter';

type PropriedadesGerenciadorTagsCartao = {
  cartao: CartaoQuadro;
  gatilho: HTMLElement;
  tagsDisponiveis: readonly string[];
  credencial: string | null;
  aoFechar: () => void;
};

// O popover fica na camada superior (fora da rolagem do quadro); a posição é
// calculada a partir do botão do cartão, abaixo dele ou, sem espaço, acima.
function posicionarJuntoAoGatilho(
  popover: HTMLElement,
  gatilho: HTMLElement,
): void {
  const retangulo = gatilho.getBoundingClientRect();
  const largura = Math.min(
    LARGURA_POPOVER_PX,
    window.innerWidth - 2 * MARGEM_JANELA_PX,
  );
  const esquerda = Math.max(
    MARGEM_JANELA_PX,
    Math.min(retangulo.left, window.innerWidth - largura - MARGEM_JANELA_PX),
  );
  const espacoAbaixo = window.innerHeight - retangulo.bottom - MARGEM_JANELA_PX;
  const espacoAcima = retangulo.top - MARGEM_JANELA_PX;
  popover.style.width = `${largura}px`;
  popover.style.left = `${esquerda}px`;
  if (espacoAbaixo >= ESPACO_MINIMO_ABAIXO_PX || espacoAbaixo >= espacoAcima) {
    popover.style.top = `${retangulo.bottom + AFASTAMENTO_GATILHO_PX}px`;
    popover.style.bottom = 'auto';
    popover.style.maxHeight = `${espacoAbaixo - AFASTAMENTO_GATILHO_PX}px`;
    return;
  }
  popover.style.top = 'auto';
  popover.style.bottom = `${window.innerHeight - retangulo.top + AFASTAMENTO_GATILHO_PX}px`;
  popover.style.maxHeight = `${espacoAcima - AFASTAMENTO_GATILHO_PX}px`;
}

function listarSugestoes(
  disponiveis: readonly string[],
  chavesVinculadas: ReadonlySet<string>,
  chaveBusca: string,
): string[] {
  return disponiveis
    .filter((nome) => {
      const chave = gerarChaveNormalizada(nome);
      return !chavesVinculadas.has(chave) && chave.includes(chaveBusca);
    })
    .sort(
      (primeira, segunda) =>
        Number(gerarChaveNormalizada(segunda) === chaveBusca) -
        Number(gerarChaveNormalizada(primeira) === chaveBusca),
    )
    .slice(0, MAXIMO_SUGESTOES);
}

// Um gerenciador por vez para o quadro inteiro (montado com a chave do
// cartão). Selecionar, criar e remover gravam na hora; a resposta da ação já
// traz o quadro revalidado, que atualiza o cartão e as sugestões.
export default function GerenciadorTagsCartao({
  cartao,
  gatilho,
  tagsDisponiveis,
  credencial,
  aoFechar,
}: PropriedadesGerenciadorTagsCartao) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState('');
  const [falha, setFalha] = useState<string | null>(null);
  const [salvando, iniciarTransicao] = useTransition();
  const idTitulo = useId();
  const idCampo = useId();
  const idDica = useId();

  const nomeDigitado = normalizarNomeExibicao(texto);
  const chaveBusca = gerarChaveNormalizada(nomeDigitado);
  const chavesVinculadas = new Set(
    cartao.tags.map((tag) => gerarChaveNormalizada(tag.nome)),
  );
  const sugestoes = listarSugestoes(
    tagsDisponiveis,
    chavesVinculadas,
    chaveBusca,
  );
  const existeEquivalente =
    chavesVinculadas.has(chaveBusca) ||
    tagsDisponiveis.some((nome) => gerarChaveNormalizada(nome) === chaveBusca);
  const podeCriar = chaveBusca !== '' && !existeEquivalente;
  const limiteAtingido =
    cartao.tags.length >= LIMITES_COLECAO.TAGS_POR_ATIVIDADE;

  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) {
      return;
    }
    posicionarJuntoAoGatilho(popover, gatilho);
    if (!popover.matches(':popover-open')) {
      popover.showPopover();
    }
    campoRef.current?.focus();
  }, [gatilho]);

  // O popover é fixo na tela e o botão rola com o quadro: a cada rolagem ou
  // redimensionamento (inclusive o teclado virtual do celular abrindo), ele é
  // reposicionado no próximo quadro de animação, sem fechar.
  useEffect(() => {
    const popover = popoverRef.current;
    if (!popover) {
      return;
    }
    let quadroAgendado: number | null = null;
    function agendarReposicionamento(): void {
      if (quadroAgendado !== null) {
        return;
      }
      quadroAgendado = requestAnimationFrame(() => {
        quadroAgendado = null;
        if (popover && gatilho.isConnected) {
          posicionarJuntoAoGatilho(popover, gatilho);
        }
      });
    }
    window.addEventListener('scroll', agendarReposicionamento, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', agendarReposicionamento);
    return () => {
      window.removeEventListener('scroll', agendarReposicionamento, {
        capture: true,
      });
      window.removeEventListener('resize', agendarReposicionamento);
      if (quadroAgendado !== null) {
        cancelAnimationFrame(quadroAgendado);
      }
    };
  }, [gatilho]);

  function alternarVisibilidade(evento: ToggleEvent<HTMLDivElement>): void {
    if (evento.newState !== 'closed') {
      return;
    }
    const focoPerdido =
      document.activeElement === document.body ||
      evento.currentTarget.contains(document.activeElement);
    if (focoPerdido && gatilho.isConnected) {
      gatilho.focus();
    }
    aoFechar();
  }

  function executar(acao: () => Promise<ResultadoAcao>): void {
    setFalha(null);
    iniciarTransicao(async () => {
      const resultado = await acao();
      if (resultado.ok) {
        setTexto('');
        campoRef.current?.focus();
      } else {
        setFalha(resultado.mensagem);
      }
    });
  }

  function vincular(nome: string): void {
    executar(() =>
      adicionarTagNoQuadro({ atividadeId: cartao.id, nome }, credencial),
    );
  }

  function desvincular(tagId: number): void {
    executar(() =>
      removerTagNoQuadro({ atividadeId: cartao.id, tagId }, credencial),
    );
  }

  function teclar(evento: KeyboardEvent<HTMLInputElement>): void {
    if (evento.key !== TECLA_CONFIRMAR) {
      return;
    }
    evento.preventDefault();
    if (salvando || limiteAtingido) {
      return;
    }
    const [primeira] = sugestoes;
    if (primeira !== undefined) {
      vincular(primeira);
    } else if (podeCriar) {
      vincular(nomeDigitado);
    }
  }

  return (
    <div
      ref={popoverRef}
      popover="auto"
      role="dialog"
      aria-labelledby={idTitulo}
      onToggle={alternarVisibilidade}
      className="m-0 inset-auto overflow-y-auto rounded-xl border border-borda bg-superficie p-0 text-texto shadow-xl"
    >
      <div className="flex flex-col gap-3 p-3">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-sm font-semibold">
              {textos.titulo}
            </h2>
            <p className="truncate text-xs text-texto-suave">{cartao.titulo}</p>
          </div>
          <button
            type="button"
            onClick={() => popoverRef.current?.hidePopover()}
            aria-label={textos.fechar}
            className="-m-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-lg text-texto-suave hover:bg-fundo focus-visible:outline-2 focus-visible:outline-primaria"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-semibold text-texto-suave">
            {textos.vinculadas}
          </h3>
          {cartao.tags.length === 0 ? (
            <p className="text-xs text-texto-suave">{textos.semVinculadas}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {cartao.tags.map((tag) => (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => desvincular(tag.id)}
                    disabled={salvando}
                    aria-label={textos.remover(tag.nome)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-full border border-borda bg-fundo py-0.5 pr-1.5 pl-2.5 text-xs hover:border-erro/50 hover:text-erro focus-visible:outline-2 focus-visible:outline-primaria disabled:opacity-60"
                  >
                    <span>{tag.nome}</span>
                    <span aria-hidden="true" className="text-sm leading-none">
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCampo} className="text-xs font-semibold">
            {textos.rotuloBusca}
          </label>
          <input
            id={idCampo}
            ref={campoRef}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={teclar}
            maxLength={LIMITES_TEXTO.NOME_TAG}
            autoComplete="off"
            disabled={limiteAtingido}
            aria-describedby={idDica}
            className="min-h-10 rounded-lg border border-borda bg-superficie px-3 text-sm focus-visible:outline-2 focus-visible:outline-primaria disabled:opacity-60"
          />
          <p id={idDica} className="text-xs text-texto-suave">
            {limiteAtingido ? textos.limite : textos.dicaBusca}
          </p>
        </div>
        {!limiteAtingido && (
          <section className="flex flex-col gap-1">
            <h3 className="text-xs font-semibold text-texto-suave">
              {textos.sugestoes}
            </h3>
            <ul className="flex flex-col">
              {sugestoes.map((nome) => (
                <li key={nome}>
                  <button
                    type="button"
                    onClick={() => vincular(nome)}
                    disabled={salvando}
                    className="flex min-h-9 w-full items-center rounded-md px-2 text-left text-sm hover:bg-fundo focus-visible:outline-2 focus-visible:outline-primaria disabled:opacity-60"
                  >
                    {nome}
                  </button>
                </li>
              ))}
              {podeCriar && (
                <li>
                  <button
                    type="button"
                    onClick={() => vincular(nomeDigitado)}
                    disabled={salvando}
                    className="flex min-h-9 w-full items-center gap-1 rounded-md px-2 text-left text-sm font-medium text-primaria hover:bg-primaria/10 focus-visible:outline-2 focus-visible:outline-primaria disabled:opacity-60"
                  >
                    <span aria-hidden="true">+</span>
                    {textos.criar(nomeDigitado)}
                  </button>
                </li>
              )}
              {sugestoes.length === 0 && !podeCriar && (
                <li className="px-2 text-xs text-texto-suave">
                  {textos.semSugestoes}
                </li>
              )}
            </ul>
          </section>
        )}
        <p role="status" className="text-xs text-texto-suave">
          {salvando ? textos.salvando : ''}
        </p>
        {falha && (
          <p role="alert" className="text-xs text-erro">
            {falha}
          </p>
        )}
      </div>
    </div>
  );
}
