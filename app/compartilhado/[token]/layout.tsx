import type { ReactNode } from 'react';

// Slot do detalhe em modal para as páginas do link compartilhado.
export default function LayoutCompartilhado({
  children,
  modal,
}: Readonly<{ children: ReactNode; modal: ReactNode }>) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
