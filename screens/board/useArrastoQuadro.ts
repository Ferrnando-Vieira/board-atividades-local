'use client';

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  calcularIndiceInsercao,
  calcularIndiceOrdenado,
  calcularVelocidadeRolagem,
  decidirInicioArraste,
  ehTeclaMovimento,
  escolherIntervaloMaisProximo,
  LIMIARES_ARRASTE,
  moverCartaoPorTecla,
  moverColunaPorTecla,
  movimentoAlteraPosicao,
  type MovimentoQuadro,
  type PosicaoCartao,
} from '@/screens/board/movimentosQuadro';
import { textosBoard } from '@/screens/board/textosBoard';
import type {
  CartaoQuadro,
  ColunaQuadro,
} from '@/servidor/board/consultaQuadro';

const ATRIBUTO_COLUNA = 'data-coluna-id';
const ATRIBUTO_CARTAO = 'data-cartao-id';
const ATRIBUTO_LISTA_COLUNA = 'data-lista-coluna';
const SELETOR_LISTA_COLUNA = `[${ATRIBUTO_LISTA_COLUNA}]`;
const TIPO_TOQUE = 'touch';
const SEM_BOTAO_PRESSIONADO = 0;
// Campos de texto dentro de um item nunca iniciam arraste (seleção de texto).
const SELETOR_SEM_ARRASTE = 'input, textarea, select, [contenteditable="true"]';
const SELETOR_COLUNA = `[${ATRIBUTO_COLUNA}]`;
const SELETOR_CARTAO = `[${ATRIBUTO_CARTAO}]`;
const TECLAS_PEGAR_SOLTAR = new Set([' ', 'Enter']);
const TECLA_CANCELAR = 'Escape';

export type ModoArrasto = 'ponteiro' | 'teclado';

export type Fantasma = {
  x: number;
  y: number;
  largura: number;
};

type ArrastoCartao = {
  tipo: 'cartao';
  atividadeId: number;
  titulo: string;
  prioridade: number;
  origem: PosicaoCartao;
  alvo: PosicaoCartao;
};

type ArrastoColuna = {
  tipo: 'coluna';
  statusId: number;
  nome: string;
  origem: number;
  alvo: number;
};

export type Arrasto = (ArrastoCartao | ArrastoColuna) & {
  modo: ModoArrasto;
  fantasma: Fantasma | null;
};

// Dados do gesto de ponteiro em andamento. Ficam fora do estado do React
// porque mudam a cada pointermove e não precisam renderizar nada.
type SessaoPonteiro = {
  pointerId: number;
  tipoPonteiro: string;
  elemento: HTMLElement;
  inicioEm: number;
  inicioX: number;
  inicioY: number;
  ultimoX: number;
  ultimoY: number;
  deslocamentoX: number;
  deslocamentoY: number;
  largura: number;
  iniciado: boolean;
  quadroAnimacao: number | null;
  temporizadorToque: number | null;
  removerOuvintes: () => void;
  item: ArrastoCartao | ArrastoColuna;
};

type EventoPonteiro = Pick<
  globalThis.PointerEvent,
  'pointerId' | 'pointerType' | 'clientX' | 'clientY' | 'buttons' | 'timeStamp'
>;

type OpcoesArrastoQuadro = {
  colunas: readonly ColunaQuadro[];
  aoSoltar: (movimento: MovimentoQuadro) => void;
  aoAnunciar: (mensagem: string) => void;
};

export const ATRIBUTOS_ARRASTE = {
  coluna: ATRIBUTO_COLUNA,
  cartao: ATRIBUTO_CARTAO,
  listaColuna: ATRIBUTO_LISTA_COLUNA,
  alcaCartao: 'data-alca-cartao',
  alcaColuna: 'data-alca-coluna',
} as const;

// Durante o arraste por toque a página não pode rolar nem abrir o menu de
// toque longo; os ouvintes precisam ser nativos e não passivos.
function impedirPadrao(evento: Event): void {
  evento.preventDefault();
}

function bloquearGestosDeToque(): void {
  document.addEventListener('touchmove', impedirPadrao, { passive: false });
  document.addEventListener('contextmenu', impedirPadrao);
}

function liberarGestosDeToque(): void {
  document.removeEventListener('touchmove', impedirPadrao);
  document.removeEventListener('contextmenu', impedirPadrao);
}

// Soltar o cartão sobre o título (um link) ou uma tag geraria um clique logo
// após o pointerup; esse único clique é descartado. O temporizador remove o
// ouvinte se o navegador não gerar clique nenhum.
function descartarProximoClique(): void {
  function descartar(evento: MouseEvent): void {
    evento.preventDefault();
    evento.stopPropagation();
  }
  window.addEventListener('click', descartar, { capture: true, once: true });
  window.setTimeout(
    () => window.removeEventListener('click', descartar, { capture: true }),
    0,
  );
}

function lerIdentificador(elemento: Element, atributo: string): number {
  return Number(elemento.getAttribute(atributo));
}

function listarElementos(raiz: ParentNode, seletor: string): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(seletor));
}

// Só a coluna sob o ponteiro importa: dentro dela o cartão vai para a
// posição da ordem automática, não para onde foi solto.
function calcularColunaSobPonteiro(
  quadro: HTMLElement,
  x: number,
): number | null {
  return escolherIntervaloMaisProximo(
    listarElementos(quadro, SELETOR_COLUNA).map((elemento) => {
      const retangulo = elemento.getBoundingClientRect();
      return {
        id: lerIdentificador(elemento, ATRIBUTO_COLUNA),
        inicio: retangulo.left,
        fim: retangulo.right,
      };
    }),
    x,
  );
}

function calcularAlvoColuna(
  quadro: HTMLElement,
  statusId: number,
  x: number,
): number {
  const centros = listarElementos(quadro, SELETOR_COLUNA)
    .filter(
      (elemento) => lerIdentificador(elemento, ATRIBUTO_COLUNA) !== statusId,
    )
    .map((elemento) => {
      const retangulo = elemento.getBoundingClientRect();
      return retangulo.left + retangulo.width / 2;
    });
  return calcularIndiceInsercao(centros, x);
}

function converterEmMovimento(item: ArrastoCartao | ArrastoColuna) {
  const movimento: MovimentoQuadro =
    item.tipo === 'cartao'
      ? {
          tipo: 'cartao',
          atividadeId: item.atividadeId,
          statusId: item.alvo.statusId,
          indice: item.alvo.indice,
        }
      : { tipo: 'coluna', statusId: item.statusId, indice: item.alvo };
  return movimento;
}

function mesmoAlvo(
  primeiro: ArrastoCartao | ArrastoColuna,
  segundo: ArrastoCartao | ArrastoColuna,
): boolean {
  if (primeiro.tipo === 'cartao' && segundo.tipo === 'cartao') {
    return (
      primeiro.alvo.statusId === segundo.alvo.statusId &&
      primeiro.alvo.indice === segundo.alvo.indice
    );
  }
  return primeiro.alvo === segundo.alvo;
}

export function useArrastoQuadro({
  colunas,
  aoSoltar,
  aoAnunciar,
}: OpcoesArrastoQuadro) {
  const [arrasto, setArrasto] = useState<Arrasto | null>(null);
  const quadroRef = useRef<HTMLDivElement>(null);
  const fantasmaRef = useRef<HTMLDivElement>(null);
  const sessaoRef = useRef<SessaoPonteiro | null>(null);
  const focoPendenteRef = useRef<string | null>(null);

  function nomeDaColuna(statusId: number): string {
    return colunas.find((coluna) => coluna.id === statusId)?.nome ?? '';
  }

  function totalNaColuna(statusId: number, atividadeId: number): number {
    const coluna = colunas.find((item) => item.id === statusId);
    const restantes =
      coluna?.atividades.filter((cartao) => cartao.id !== atividadeId).length ??
      0;
    return restantes + 1;
  }

  function anunciarPosicao(item: ArrastoCartao | ArrastoColuna): void {
    aoAnunciar(
      item.tipo === 'cartao'
        ? textosBoard.anuncios.moveuCartao(
            item.alvo.indice + 1,
            totalNaColuna(item.alvo.statusId, item.atividadeId),
            nomeDaColuna(item.alvo.statusId),
          )
        : textosBoard.anuncios.moveuColuna(item.alvo + 1, colunas.length),
    );
  }

  function anunciarSoltura(item: ArrastoCartao | ArrastoColuna): void {
    aoAnunciar(
      item.tipo === 'cartao'
        ? textosBoard.anuncios.soltouCartao(
            item.titulo,
            item.alvo.indice + 1,
            nomeDaColuna(item.alvo.statusId),
          )
        : textosBoard.anuncios.soltouColuna(item.nome, item.alvo + 1),
    );
  }

  function anunciarCancelamento(item: ArrastoCartao | ArrastoColuna): void {
    aoAnunciar(
      item.tipo === 'cartao'
        ? textosBoard.anuncios.cancelouCartao(item.titulo)
        : textosBoard.anuncios.cancelouColuna(item.nome),
    );
  }

  // Ao soltar, o cartão pode trocar de coluna e ser remontado; o foco do
  // teclado volta para a alça dele na nova posição.
  useEffect(() => {
    const seletor = focoPendenteRef.current;
    if (seletor === null) {
      return;
    }
    focoPendenteRef.current = null;
    document.querySelector<HTMLElement>(seletor)?.focus();
  }, [colunas]);

  function concluir(
    item: ArrastoCartao | ArrastoColuna,
    modo: ModoArrasto,
  ): void {
    setArrasto(null);
    const movimento = converterEmMovimento(item);
    if (!movimentoAlteraPosicao(colunas, movimento)) {
      anunciarCancelamento(item);
      return;
    }
    if (modo === 'teclado') {
      focoPendenteRef.current =
        item.tipo === 'cartao'
          ? `[${ATRIBUTOS_ARRASTE.alcaCartao}="${item.atividadeId}"]`
          : `[${ATRIBUTOS_ARRASTE.alcaColuna}="${item.statusId}"]`;
    }
    anunciarSoltura(item);
    aoSoltar(movimento);
  }

  function cancelar(): void {
    encerrarSessao();
    if (arrasto) {
      anunciarCancelamento(arrasto);
    }
    setArrasto(null);
  }

  const cancelarPorTecla = useEffectEvent(
    (evento: globalThis.KeyboardEvent) => {
      if (evento.key === TECLA_CANCELAR) {
        cancelar();
      }
    },
  );

  const encerrarAoDesmontar = useEffectEvent(() => encerrarSessao());
  useEffect(() => () => encerrarAoDesmontar(), []);

  const modoAtual = arrasto?.modo ?? null;
  useEffect(() => {
    if (modoAtual !== 'ponteiro') {
      return;
    }
    window.addEventListener('keydown', cancelarPorTecla);
    return () => window.removeEventListener('keydown', cancelarPorTecla);
  }, [modoAtual]);

  function recalcularAlvo(sessao: SessaoPonteiro): void {
    const quadro = quadroRef.current;
    if (!quadro) {
      return;
    }
    const atual = sessao.item;
    let proximo: ArrastoCartao | ArrastoColuna = atual;
    if (atual.tipo === 'cartao') {
      const statusId = calcularColunaSobPonteiro(quadro, sessao.ultimoX);
      proximo =
        statusId === null
          ? atual
          : {
              ...atual,
              alvo: {
                statusId,
                indice: calcularIndiceOrdenado(
                  colunas,
                  atual.atividadeId,
                  statusId,
                ),
              },
            };
    } else {
      proximo = {
        ...atual,
        alvo: calcularAlvoColuna(quadro, atual.statusId, sessao.ultimoX),
      };
    }
    if (mesmoAlvo(atual, proximo)) {
      return;
    }
    sessao.item = proximo;
    setArrasto((anterior) =>
      anterior ? { ...anterior, ...proximo, modo: anterior.modo } : anterior,
    );
  }

  // Enquanto o ponteiro estiver perto das bordas, o quadro rola sozinho (na
  // horizontal pelas colunas e na vertical pela página) e o alvo é refeito.
  function rolarAutomaticamente(): void {
    const sessao = sessaoRef.current;
    const quadro = quadroRef.current;
    if (!sessao?.iniciado || !quadro) {
      return;
    }
    const retangulo = quadro.getBoundingClientRect();
    const velocidadeHorizontal = calcularVelocidadeRolagem(
      sessao.ultimoX,
      retangulo.left,
      retangulo.right,
    );
    const velocidadeVertical = calcularVelocidadeRolagem(
      sessao.ultimoY,
      0,
      window.innerHeight,
    );
    if (velocidadeHorizontal !== 0) {
      quadro.scrollLeft += velocidadeHorizontal;
    }
    if (velocidadeVertical !== 0) {
      window.scrollBy(0, velocidadeVertical);
    }
    rolarListaSobPonteiro(sessao);
    if (velocidadeHorizontal !== 0 || velocidadeVertical !== 0) {
      recalcularAlvo(sessao);
    }
    sessao.quadroAnimacao = requestAnimationFrame(rolarAutomaticamente);
  }

  // Nas colunas que rolam por dentro (desktop), o ponteiro perto da borda de
  // cima ou de baixo da lista também a faz rolar.
  function rolarListaSobPonteiro(sessao: SessaoPonteiro): void {
    const lista = document
      .elementFromPoint(sessao.ultimoX, sessao.ultimoY)
      ?.closest<HTMLElement>(SELETOR_LISTA_COLUNA);
    if (!lista || lista.scrollHeight <= lista.clientHeight) {
      return;
    }
    const retangulo = lista.getBoundingClientRect();
    const velocidade = calcularVelocidadeRolagem(
      sessao.ultimoY,
      retangulo.top,
      retangulo.bottom,
    );
    if (velocidade !== 0) {
      lista.scrollTop += velocidade;
    }
  }

  function encerrarSessao(): void {
    const sessao = sessaoRef.current;
    if (!sessao) {
      return;
    }
    if (sessao.quadroAnimacao) {
      cancelAnimationFrame(sessao.quadroAnimacao);
    }
    if (sessao.temporizadorToque !== null) {
      window.clearTimeout(sessao.temporizadorToque);
    }
    if (sessao.iniciado && sessao.tipoPonteiro === TIPO_TOQUE) {
      liberarGestosDeToque();
    }
    sessao.removerOuvintes();
    sessaoRef.current = null;
  }

  // Ponto em que o gesto vira arraste: o elemento passa a capturar o
  // ponteiro (os movimentos seguem chegando mesmo fora dele) e o fantasma
  // aparece. Até aqui, cliques no título, nas tags e nos botões do cartão
  // funcionam normalmente, porque nada foi capturado nem cancelado.
  function iniciarArraste(sessao: SessaoPonteiro): void {
    sessao.iniciado = true;
    if (sessao.temporizadorToque !== null) {
      window.clearTimeout(sessao.temporizadorToque);
      sessao.temporizadorToque = null;
    }
    try {
      sessao.elemento.setPointerCapture(sessao.pointerId);
    } catch {
      // Ponteiro já liberado pelo navegador: o pointerup encerra a sessão.
    }
    if (sessao.tipoPonteiro === TIPO_TOQUE) {
      bloquearGestosDeToque();
    }
    window.getSelection()?.removeAllRanges();
    setArrasto({
      ...sessao.item,
      modo: 'ponteiro',
      fantasma: {
        x: sessao.ultimoX - sessao.deslocamentoX,
        y: sessao.ultimoY - sessao.deslocamentoY,
        largura: sessao.largura,
      },
    });
    sessao.quadroAnimacao = requestAnimationFrame(rolarAutomaticamente);
  }

  function prepararPonteiro(
    evento: PointerEvent<HTMLElement>,
    item: ArrastoCartao | ArrastoColuna,
  ): void {
    if (
      arrasto ||
      (evento.pointerType === 'mouse' && evento.button !== 0) ||
      !evento.isPrimary ||
      (evento.target as Element).closest(SELETOR_SEM_ARRASTE)
    ) {
      return;
    }
    encerrarSessao();
    const elemento = evento.currentTarget;
    const retangulo = (
      elemento.closest<HTMLElement>(
        item.tipo === 'cartao' ? SELETOR_CARTAO : SELETOR_COLUNA,
      ) ?? elemento
    ).getBoundingClientRect();
    const sessao: SessaoPonteiro = {
      pointerId: evento.pointerId,
      tipoPonteiro: evento.pointerType,
      elemento,
      inicioEm: evento.timeStamp,
      inicioX: evento.clientX,
      inicioY: evento.clientY,
      ultimoX: evento.clientX,
      ultimoY: evento.clientY,
      deslocamentoX: evento.clientX - retangulo.left,
      deslocamentoY: evento.clientY - retangulo.top,
      largura: retangulo.width,
      iniciado: false,
      quadroAnimacao: null,
      temporizadorToque: null,
      removerOuvintes: () => undefined,
      item,
    };
    // Os movimentos são ouvidos na janela: um gesto rápido sai do item antes
    // de passar do limiar, e o item só captura o ponteiro depois disso (para
    // não roubar o clique do título e das tags).
    window.addEventListener('pointermove', moverPonteiro);
    window.addEventListener('pointerup', soltarPonteiro);
    window.addEventListener('pointercancel', cancelarPonteiro);
    sessao.removerOuvintes = () => {
      window.removeEventListener('pointermove', moverPonteiro);
      window.removeEventListener('pointerup', soltarPonteiro);
      window.removeEventListener('pointercancel', cancelarPonteiro);
    };
    if (sessao.tipoPonteiro === TIPO_TOQUE) {
      sessao.temporizadorToque = window.setTimeout(() => {
        if (sessaoRef.current === sessao && !sessao.iniciado) {
          iniciarArraste(sessao);
        }
      }, LIMIARES_ARRASTE.ESPERA_TOQUE_MS);
    }
    sessaoRef.current = sessao;
  }

  function iniciarPonteiroCartao(
    evento: PointerEvent<HTMLElement>,
    cartao: CartaoQuadro,
    posicao: PosicaoCartao,
  ): void {
    prepararPonteiro(evento, {
      tipo: 'cartao',
      atividadeId: cartao.id,
      titulo: cartao.titulo,
      prioridade: cartao.prioridade,
      origem: posicao,
      alvo: posicao,
    });
  }

  function iniciarPonteiroColuna(
    evento: PointerEvent<HTMLElement>,
    coluna: ColunaQuadro,
    indice: number,
  ): void {
    prepararPonteiro(evento, {
      tipo: 'coluna',
      statusId: coluna.id,
      nome: coluna.nome,
      origem: indice,
      alvo: indice,
    });
  }

  function moverFantasma(sessao: SessaoPonteiro): void {
    const fantasma = fantasmaRef.current;
    if (fantasma) {
      fantasma.style.transform = `translate3d(${sessao.ultimoX - sessao.deslocamentoX}px, ${sessao.ultimoY - sessao.deslocamentoY}px, 0)`;
    }
  }

  function moverPonteiro(evento: EventoPonteiro): void {
    const sessao = sessaoRef.current;
    if (!sessao || sessao.pointerId !== evento.pointerId) {
      return;
    }
    sessao.ultimoX = evento.clientX;
    sessao.ultimoY = evento.clientY;
    if (sessao.iniciado) {
      moverFantasma(sessao);
      recalcularAlvo(sessao);
      return;
    }
    // Botão solto fora do item (sem pointerup aqui): o gesto acabou.
    if (
      evento.pointerType === 'mouse' &&
      evento.buttons === SEM_BOTAO_PRESSIONADO
    ) {
      encerrarSessao();
      return;
    }
    const decisao = decidirInicioArraste({
      tipoPonteiro: sessao.tipoPonteiro,
      distancia: Math.hypot(
        evento.clientX - sessao.inicioX,
        evento.clientY - sessao.inicioY,
      ),
      decorridoMs: evento.timeStamp - sessao.inicioEm,
    });
    if (decisao === 'iniciar') {
      iniciarArraste(sessao);
      recalcularAlvo(sessao);
    } else if (decisao === 'desistir') {
      encerrarSessao();
    }
  }

  function soltarPonteiro(evento: EventoPonteiro): void {
    const sessao = sessaoRef.current;
    if (!sessao || sessao.pointerId !== evento.pointerId) {
      return;
    }
    encerrarSessao();
    if (sessao.iniciado) {
      // Um gesto rápido pode soltar antes de outro pointermove: o alvo é
      // recalculado no ponto em que o ponteiro foi solto.
      sessao.ultimoX = evento.clientX;
      sessao.ultimoY = evento.clientY;
      recalcularAlvo(sessao);
      descartarProximoClique();
      concluir(sessao.item, 'ponteiro');
    }
  }

  // Rolagem iniciada pelo navegador (toque): o gesto pendente é
  // abandonado; o arraste já iniciado é cancelado.
  function cancelarPonteiro(evento: EventoPonteiro): void {
    const sessao = sessaoRef.current;
    if (sessao?.pointerId !== evento.pointerId) {
      return;
    }
    encerrarSessao();
    // O ouvinte foi registrado no início do gesto: o item vem da sessão, não
    // do estado daquela renderização.
    if (sessao.iniciado) {
      anunciarCancelamento(sessao.item);
      setArrasto(null);
    }
  }

  function iniciarTeclado(item: ArrastoCartao | ArrastoColuna): void {
    setArrasto({ ...item, modo: 'teclado', fantasma: null });
    aoAnunciar(
      item.tipo === 'cartao'
        ? textosBoard.anuncios.pegouCartao(
            item.titulo,
            item.origem.indice + 1,
            totalNaColuna(item.origem.statusId, item.atividadeId),
            nomeDaColuna(item.origem.statusId),
          )
        : textosBoard.anuncios.pegouColuna(
            item.nome,
            item.origem + 1,
            colunas.length,
          ),
    );
  }

  function reposicionarPorTecla(
    atual: Arrasto,
    tecla: Parameters<typeof moverColunaPorTecla>[2],
  ): void {
    const proximo: ArrastoCartao | ArrastoColuna =
      atual.tipo === 'cartao'
        ? {
            ...atual,
            alvo: moverCartaoPorTecla(
              colunas,
              atual.atividadeId,
              atual.alvo,
              tecla,
            ),
          }
        : {
            ...atual,
            alvo: moverColunaPorTecla(colunas.length, atual.alvo, tecla),
          };
    setArrasto({ ...atual, ...proximo });
    anunciarPosicao(proximo);
  }

  function teclar(
    evento: KeyboardEvent<HTMLElement>,
    item: ArrastoCartao | ArrastoColuna,
  ): void {
    const emCurso =
      arrasto?.modo === 'teclado' &&
      (arrasto.tipo === 'cartao'
        ? item.tipo === 'cartao' && arrasto.atividadeId === item.atividadeId
        : item.tipo === 'coluna' && arrasto.statusId === item.statusId)
        ? arrasto
        : null;
    if (TECLAS_PEGAR_SOLTAR.has(evento.key)) {
      evento.preventDefault();
      if (emCurso) {
        concluir(emCurso, 'teclado');
      } else if (!arrasto) {
        iniciarTeclado(item);
      }
      return;
    }
    if (!emCurso) {
      return;
    }
    if (evento.key === TECLA_CANCELAR) {
      evento.preventDefault();
      cancelar();
      return;
    }
    if (ehTeclaMovimento(evento.key)) {
      evento.preventDefault();
      reposicionarPorTecla(emCurso, evento.key);
    }
  }

  function teclarAlcaCartao(
    evento: KeyboardEvent<HTMLElement>,
    cartao: CartaoQuadro,
    posicao: PosicaoCartao,
  ): void {
    teclar(evento, {
      tipo: 'cartao',
      atividadeId: cartao.id,
      titulo: cartao.titulo,
      prioridade: cartao.prioridade,
      origem: posicao,
      alvo: posicao,
    });
  }

  function teclarAlcaColuna(
    evento: KeyboardEvent<HTMLElement>,
    coluna: ColunaQuadro,
    indice: number,
  ): void {
    teclar(evento, {
      tipo: 'coluna',
      statusId: coluna.id,
      nome: coluna.nome,
      origem: indice,
      alvo: indice,
    });
  }

  function sairDaAlca(): void {
    if (arrasto?.modo === 'teclado') {
      cancelar();
    }
  }

  return {
    arrasto,
    quadroRef,
    fantasmaRef,
    manipuladores: {
      iniciarPonteiroCartao,
      iniciarPonteiroColuna,
      teclarAlcaCartao,
      teclarAlcaColuna,
      sairDaAlca,
    },
  };
}

export type ManipuladoresArrasto = ReturnType<
  typeof useArrastoQuadro
>['manipuladores'];
