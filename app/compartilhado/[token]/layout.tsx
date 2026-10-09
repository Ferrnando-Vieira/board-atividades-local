import type { ReactNode } from 'react';

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
