import type { ReactNode } from 'react';
import { combinarClasses } from '@/util/ClassesUtils';

type PropriedadesCartao = {
  children: ReactNode;
  className?: string;
};

export default function Cartao({ children, className }: PropriedadesCartao) {
  return (
    <section
      className={combinarClasses(
        'rounded-2xl border border-borda/80 bg-superficie p-4 text-texto shadow-cartao sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  );
}
