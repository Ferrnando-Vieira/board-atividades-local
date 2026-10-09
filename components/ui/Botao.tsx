import type { ButtonHTMLAttributes } from 'react';
import { combinarClasses } from '@/util/ClassesUtils';

export type VarianteBotao = 'primario' | 'secundario' | 'perigo' | 'fantasma';

type PropriedadesBotao = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
};

const CLASSES_BASE =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[background-color,box-shadow,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto';

const CLASSES_VARIANTE: Record<VarianteBotao, string> = {
  primario:
    'bg-primaria text-white shadow-cartao hover:bg-primaria-escura hover:shadow-elevado',
  secundario:
    'border border-borda bg-superficie text-texto shadow-cartao hover:border-texto-suave/40 hover:bg-fundo',
  perigo: 'bg-erro text-white shadow-cartao hover:bg-erro/90',
  fantasma: 'text-texto hover:bg-texto/5',
};

export function obterClassesBotao(
  variante: VarianteBotao = 'primario',
  classesExtras?: string,
): string {
  return combinarClasses(
    CLASSES_BASE,
    CLASSES_VARIANTE[variante],
    classesExtras,
  );
}

export default function Botao({
  variante = 'primario',
  className,
  type = 'button',
  ...propriedades
}: PropriedadesBotao) {
  return (
    <button
      type={type}
      className={obterClassesBotao(variante, className)}
      {...propriedades}
    />
  );
}
