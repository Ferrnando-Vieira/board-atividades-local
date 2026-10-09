import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { textosAplicacao } from '@/screens/aplicacao/textosAplicacao';
import './globals.css';

const COR_TEMA = '#226020';

export const metadata: Metadata = {
  title: textosAplicacao.titulo,
  description: textosAplicacao.descricao,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: COR_TEMA,
};

// "modal" recebe o detalhe da atividade aberto por cima do quadro (rota
// interceptada em app/@modal).
export default function LayoutRaiz({
  children,
  modal,
}: Readonly<{ children: ReactNode; modal: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-fundo font-sans text-texto antialiased">
        {children}
        {modal}
      </body>
    </html>
  );
}
