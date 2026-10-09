import type { MovimentoPorPosicao } from '@/servidor/atividades/esquemasAtividades';
import type { ReordenacaoStatus } from '@/servidor/board/esquemasStatus';
import type {
  CartaoQuadro,
  ColunaQuadro,
} from '@/servidor/board/consultaQuadro';
import { moverParaPosicao } from '@/util/ListaUtils';
import {
  compararPorConclusaoRecente,
  compararPorPrazoETitulo,
  ordenarNaColuna,
} from '@/util/OrdenacaoAtividadesUtils';

// Ao concluir pelo quadro o servidor grava "agora", que é a conclusão mais
// recente possível; até o quadro revalidado chegar, o cartão sem conclusão
// vai para o topo com este marcador.
const CONCLUSAO_OTIMISTA = '9999-12-31';

export type PosicaoCartao = {
  statusId: number;
  indice: number;
};

export type MovimentoCartao = PosicaoCartao & {
  tipo: 'cartao';
  atividadeId: number;
};

export type MovimentoColuna = {
  tipo: 'coluna';
  statusId: number;
  indice: number;
};

export type MovimentoQuadro = MovimentoCartao | MovimentoColuna;

export type LocalizacaoCartao = {
  cartao: CartaoQuadro;
  coluna: ColunaQuadro;
  posicao: PosicaoCartao;
};

export type Intervalo = {
  id: number;
  inicio: number;
  fim: number;
};

export const TECLAS_MOVIMENTO = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
] as const;

export type TeclaMovimento = (typeof TECLAS_MOVIMENTO)[number];

const MARGEM_ROLAGEM_AUTOMATICA = 56;
const VELOCIDADE_MAXIMA_ROLAGEM = 20;

// O arraste começa de qualquer ponto do cartão. Com mouse ou caneta, basta
// passar do limiar de distância (um clique parado continua sendo clique).
// No toque, o dedo precisa ficar parado um instante: mexer antes disso é
// rolagem da página ou deslize entre colunas, e o arraste é abandonado.
export const LIMIARES_ARRASTE = {
  DISTANCIA_PONTEIRO_PX: 5,
  TOLERANCIA_TOQUE_PX: 8,
  ESPERA_TOQUE_MS: 250,
} as const;

export type DecisaoInicioArraste = 'aguardar' | 'iniciar' | 'desistir';

export type GestoPendente = {
  tipoPonteiro: string;
  distancia: number;
  decorridoMs: number;
};

export function decidirInicioArraste(
  gesto: GestoPendente,
): DecisaoInicioArraste {
  if (gesto.tipoPonteiro === 'touch') {
    if (gesto.distancia > LIMIARES_ARRASTE.TOLERANCIA_TOQUE_PX) {
      return 'desistir';
    }
    return gesto.decorridoMs >= LIMIARES_ARRASTE.ESPERA_TOQUE_MS
      ? 'iniciar'
      : 'aguardar';
  }
  return gesto.distancia >= LIMIARES_ARRASTE.DISTANCIA_PONTEIRO_PX
    ? 'iniciar'
    : 'aguardar';
}

export function ehTeclaMovimento(tecla: string): tecla is TeclaMovimento {
  return (TECLAS_MOVIMENTO as readonly string[]).includes(tecla);
}

export function localizarCartao(
  colunas: readonly ColunaQuadro[],
  atividadeId: number,
): LocalizacaoCartao | null {
  for (const coluna of colunas) {
    const indice = coluna.atividades.findIndex(
      (cartao) => cartao.id === atividadeId,
    );
    const cartao = coluna.atividades[indice];
    if (cartao) {
      return { cartao, coluna, posicao: { statusId: coluna.id, indice } };
    }
  }
  return null;
}

// Dentro da coluna a posição é automática: o índice de destino é o lugar que
// a regra de ordenação da coluna dá ao cartão, sem contar ele mesmo.
export function calcularIndiceOrdenado(
  colunas: readonly ColunaQuadro[],
  atividadeId: number,
  statusId: number,
): number {
  const cartao = localizarCartao(colunas, atividadeId)?.cartao;
  const coluna = colunas.find((item) => item.id === statusId);
  if (!cartao || !coluna) {
    return 0;
  }
  const comparar = coluna.finalizaAtividade
    ? compararPorConclusaoRecente
    : compararPorPrazoETitulo;
  const candidato =
    coluna.finalizaAtividade && !cartao.concluidaEmData
      ? { ...cartao, concluidaEmData: CONCLUSAO_OTIMISTA }
      : cartao;
  return coluna.atividades.filter(
    (outro) => outro.id !== atividadeId && comparar(outro, candidato) < 0,
  ).length;
}

// Só a troca de status muda algo: reposicionar na mesma coluna não sobrepõe
// a ordem automática.
export function movimentoAlteraPosicao(
  colunas: readonly ColunaQuadro[],
  movimento: MovimentoQuadro,
): boolean {
  if (movimento.tipo === 'coluna') {
    return (
      colunas.findIndex((coluna) => coluna.id === movimento.statusId) !==
      movimento.indice
    );
  }
  const origem = localizarCartao(colunas, movimento.atividadeId);
  return origem !== null && origem.posicao.statusId !== movimento.statusId;
}

// Espelha o servidor: a versão só avança quando o status muda. Sem essa
// previsão, um segundo arraste feito antes da resposta do primeiro levaria a
// versão antiga e seria recusado como conflito. O índice do movimento é
// ignorado: o cartão entra onde a ordem automática manda.
export function aplicarMovimentoCartao(
  colunas: readonly ColunaQuadro[],
  movimento: MovimentoCartao,
): ColunaQuadro[] {
  const origem = localizarCartao(colunas, movimento.atividadeId);
  const existeDestino = colunas.some(
    (coluna) => coluna.id === movimento.statusId,
  );
  if (
    !origem ||
    !existeDestino ||
    origem.posicao.statusId === movimento.statusId
  ) {
    return [...colunas];
  }
  const cartaoMovido = { ...origem.cartao, versao: origem.cartao.versao + 1 };
  return colunas.map((coluna) => {
    const restantes = coluna.atividades.filter(
      (cartao) => cartao.id !== movimento.atividadeId,
    );
    if (coluna.id !== movimento.statusId) {
      return { ...coluna, atividades: restantes };
    }
    const concluido =
      coluna.finalizaAtividade && !cartaoMovido.concluidaEmData
        ? { ...cartaoMovido, concluidaEmData: CONCLUSAO_OTIMISTA }
        : cartaoMovido;
    return {
      ...coluna,
      atividades: ordenarNaColuna(
        [...restantes, concluido],
        coluna.finalizaAtividade,
      ),
    };
  });
}

export function aplicarMovimentoColuna(
  colunas: readonly ColunaQuadro[],
  movimento: MovimentoColuna,
): ColunaQuadro[] {
  const coluna = colunas.find((item) => item.id === movimento.statusId);
  return coluna
    ? moverParaPosicao(colunas, coluna, movimento.indice)
    : [...colunas];
}

export function aplicarMovimento(
  colunas: ColunaQuadro[],
  movimento: MovimentoQuadro,
): ColunaQuadro[] {
  return movimento.tipo === 'cartao'
    ? aplicarMovimentoCartao(colunas, movimento)
    : aplicarMovimentoColuna(colunas, movimento);
}

// O servidor decide a posição (ordem automática), então a carga leva só o
// status de destino e a versão vista; sem troca de status não há o que gravar.
export function montarCargaMovimentoCartao(
  colunas: readonly ColunaQuadro[],
  movimento: MovimentoCartao,
): MovimentoPorPosicao | null {
  const origem = localizarCartao(colunas, movimento.atividadeId);
  if (!origem || origem.posicao.statusId === movimento.statusId) {
    return null;
  }
  return {
    atividadeId: movimento.atividadeId,
    versaoEsperada: origem.cartao.versao,
    statusDestinoId: movimento.statusId,
    posicao: null,
  };
}

export function montarCargaReordenacao(
  colunas: readonly ColunaQuadro[],
  movimento: MovimentoColuna,
): ReordenacaoStatus {
  return {
    statusId: movimento.statusId,
    ordemNova: aplicarMovimentoColuna(colunas, movimento).map(
      (coluna) => coluna.id,
    ),
  };
}

// Escolhe o intervalo que contém a coordenada ou, fora de todos, o mais
// próximo: soltar no espaço entre duas colunas não pode ser ignorado.
export function escolherIntervaloMaisProximo(
  intervalos: readonly Intervalo[],
  coordenada: number,
): number | null {
  let maisProximo: Intervalo | null = null;
  let menorDistancia = Number.POSITIVE_INFINITY;
  for (const intervalo of intervalos) {
    const distancia =
      coordenada < intervalo.inicio
        ? intervalo.inicio - coordenada
        : Math.max(0, coordenada - intervalo.fim);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      maisProximo = intervalo;
    }
  }
  return maisProximo?.id ?? null;
}

// O índice de inserção é a quantidade de itens cujo centro fica antes da
// coordenada; os centros vêm na ordem em que os itens aparecem.
export function calcularIndiceInsercao(
  centros: readonly number[],
  coordenada: number,
): number {
  return centros.filter((centro) => centro < coordenada).length;
}

export function calcularVelocidadeRolagem(
  coordenada: number,
  inicio: number,
  fim: number,
): number {
  const distanciaInicio = coordenada - inicio;
  const distanciaFim = fim - coordenada;
  if (distanciaInicio < MARGEM_ROLAGEM_AUTOMATICA) {
    const intensidade =
      1 - Math.max(distanciaInicio, 0) / MARGEM_ROLAGEM_AUTOMATICA;
    return -Math.ceil(intensidade * VELOCIDADE_MAXIMA_ROLAGEM);
  }
  if (distanciaFim < MARGEM_ROLAGEM_AUTOMATICA) {
    const intensidade =
      1 - Math.max(distanciaFim, 0) / MARGEM_ROLAGEM_AUTOMATICA;
    return Math.ceil(intensidade * VELOCIDADE_MAXIMA_ROLAGEM);
  }
  return 0;
}

// Para os lados troca de coluna, já na posição automática do destino. Cima,
// baixo, Home e End não mudam nada: a ordem dentro da coluna não é manual.
export function moverCartaoPorTecla(
  colunas: readonly ColunaQuadro[],
  atividadeId: number,
  posicao: PosicaoCartao,
  tecla: TeclaMovimento,
): PosicaoCartao {
  if (tecla !== 'ArrowLeft' && tecla !== 'ArrowRight') {
    return posicao;
  }
  const indiceColuna = colunas.findIndex(
    (coluna) => coluna.id === posicao.statusId,
  );
  const deslocamento = tecla === 'ArrowLeft' ? -1 : 1;
  const vizinha = colunas[indiceColuna + deslocamento];
  if (indiceColuna < 0 || !vizinha) {
    return posicao;
  }
  return {
    statusId: vizinha.id,
    indice: calcularIndiceOrdenado(colunas, atividadeId, vizinha.id),
  };
}

export function moverColunaPorTecla(
  quantidadeColunas: number,
  indice: number,
  tecla: TeclaMovimento,
): number {
  const ultimoIndice = quantidadeColunas - 1;
  if (tecla === 'ArrowLeft' || tecla === 'ArrowUp') {
    return Math.max(indice - 1, 0);
  }
  if (tecla === 'ArrowRight' || tecla === 'ArrowDown') {
    return Math.min(indice + 1, ultimoIndice);
  }
  return tecla === 'Home' ? 0 : ultimoIndice;
}

export type ElementoComIndicador<T> =
  { tipo: 'item'; item: T; indice: number } | { tipo: 'indicador' };

// O item arrastado continua no lugar (esmaecido) e não conta nas posições;
// o indicador marca onde ele vai entrar. Quando o destino coincide com a
// origem, o indicador aparece logo antes do próprio item.
export function intercalarIndicador<T>(
  itens: readonly T[],
  ehArrastado: (item: T) => boolean,
  indiceIndicador: number | null,
): ElementoComIndicador<T>[] {
  const elementos: ElementoComIndicador<T>[] = [];
  let posicao = 0;
  let indicadorInserido = indiceIndicador === null;
  itens.forEach((item, indice) => {
    if (!indicadorInserido && posicao === indiceIndicador) {
      elementos.push({ tipo: 'indicador' });
      indicadorInserido = true;
    }
    elementos.push({ tipo: 'item', item, indice });
    if (!ehArrastado(item)) {
      posicao += 1;
    }
  });
  if (!indicadorInserido && posicao === indiceIndicador) {
    elementos.push({ tipo: 'indicador' });
  }
  return elementos;
}
