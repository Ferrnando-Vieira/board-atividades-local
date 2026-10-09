'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { combinarClasses } from '@/util/ClassesUtils';

const TECLA_ESCAPE = 'Escape';

type PropriedadesMenuSuspenso = {
  rotulo: string;
  conteudoBotao: ReactNode;
  children: ReactNode;
  classesBotao?: string;
  classesPainel?: string;
  // "dialog" para painéis com formulário; "menu" só para listas de ações.
  tipo?: 'dialog' | 'menu';
  aoAbrir?: () => void;
};

// Painel que abre abaixo do botão e fecha com Esc, clique fora ou ao seguir
// um link de dentro. O conteúdo é renderizado mesmo fechado (escondido), para
// que os links existam no HTML do servidor e funcionem sem JavaScript
// carregado.
export default function MenuSuspenso({
  rotulo,
  conteudoBotao,
  children,
  classesBotao,
  classesPainel,
  tipo = 'dialog',
  aoAbrir,
}: PropriedadesMenuSuspenso) {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const idPainel = useId();

  useEffect(() => {
    if (!aberto) {
      return;
    }
    function fecharAoClicarFora(evento: PointerEvent): void {
      if (!raizRef.current?.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('pointerdown', fecharAoClicarFora);
    return () =>
      document.removeEventListener('pointerdown', fecharAoClicarFora);
  }, [aberto]);

  function alternar(): void {
    setAberto((atual) => {
      if (!atual) {
        aoAbrir?.();
      }
      return !atual;
    });
  }

  function fecharComTeclado(evento: KeyboardEvent<HTMLDivElement>): void {
    if (evento.key === TECLA_ESCAPE && aberto) {
      evento.stopPropagation();
      setAberto(false);
      botaoRef.current?.focus();
    }
  }

  function fecharAoNavegar(evento: MouseEvent<HTMLDivElement>): void {
    if ((evento.target as HTMLElement).closest('a[href]')) {
      setAberto(false);
    }
  }

  return (
    <div ref={raizRef} className="relative" onKeyDown={fecharComTeclado}>
      <button
        ref={botaoRef}
        type="button"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-controls={idPainel}
        aria-haspopup={tipo}
        onClick={alternar}
        className={combinarClasses(
          'inline-flex min-h-10 items-center justify-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-primaria',
          classesBotao,
        )}
      >
        {conteudoBotao}
      </button>
      <div
        id={idPainel}
        hidden={!aberto}
        onClick={fecharAoNavegar}
        className={combinarClasses(
          'absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right animate-surgir rounded-2xl border border-borda bg-superficie p-2 text-texto shadow-flutuante',
          classesPainel,
        )}
      >
        {children}
      </div>
    </div>
  );
}
