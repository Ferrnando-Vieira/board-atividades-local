'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  interpretarFiltrosSalvos,
  serializarFiltros,
  type FiltrosQuadro,
} from '@/screens/board/filtrosQuadro';

const PREFIXO_CHAVE = 'board-atividades:filtros:';
const CHAVE_PAINEL = 'painel';

const ouvintes = new Set<() => void>();
// Reserva para quando o sessionStorage está bloqueado (modo privado ou
// política do navegador): os filtros valem até recarregar a página.
const reservaMemoria = new Map<string, string>();

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function lerTexto(chave: string): string | null {
  try {
    return window.sessionStorage.getItem(chave);
  } catch {
    return reservaMemoria.get(chave) ?? null;
  }
}

function gravarTexto(chave: string, texto: string): void {
  try {
    window.sessionStorage.setItem(chave, texto);
  } catch {
    reservaMemoria.set(chave, texto);
  }
  ouvintes.forEach((ouvinte) => ouvinte());
}

function lerNoServidor(): null {
  return null;
}

// Cada acesso (painel ou link) guarda os seus filtros na sessão da aba, então
// eles sobrevivem à criação, à edição em outra tela e aos movimentos, e somem
// quando a aba é fechada. Na hidratação vale "sem filtro", como no servidor.
export function useFiltrosQuadro(prefixoRotas: string) {
  const chave = `${PREFIXO_CHAVE}${prefixoRotas || CHAVE_PAINEL}`;
  const lerSessao = useCallback(() => lerTexto(chave), [chave]);
  const texto = useSyncExternalStore(assinar, lerSessao, lerNoServidor);
  const filtros = useMemo(() => interpretarFiltrosSalvos(texto), [texto]);
  const definirFiltros = useCallback(
    (proximos: FiltrosQuadro) =>
      gravarTexto(chave, serializarFiltros(proximos)),
    [chave],
  );
  return { filtros, definirFiltros };
}
