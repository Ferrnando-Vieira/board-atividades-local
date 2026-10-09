import type { ReactNode } from 'react';
import { combinarClasses } from '@/util/ClassesUtils';

export const CLASSES_CONTROLE =
  'rounded-xl border bg-superficie px-3 text-base text-texto transition-colors hover:border-texto-suave/50 focus-visible:border-primaria focus-visible:outline-2 focus-visible:outline-primaria disabled:opacity-60';

export type DescricaoCampo = {
  possuiErro: boolean;
  idDica?: string;
  idErro?: string;
  idsDescricao?: string;
};

export function descreverCampo(
  id: string,
  dica?: string,
  erros?: string[],
): DescricaoCampo {
  const possuiErro = Boolean(erros?.length);
  const idDica = dica ? `${id}-dica` : undefined;
  const idErro = possuiErro ? `${id}-erro` : undefined;
  return {
    possuiErro,
    idDica,
    idErro,
    idsDescricao: [idDica, idErro].filter(Boolean).join(' ') || undefined,
  };
}

export function classesControle(
  possuiErro: boolean,
  classesExtras?: string,
): string {
  return combinarClasses(
    CLASSES_CONTROLE,
    possuiErro ? 'border-erro' : 'border-borda',
    classesExtras,
  );
}

type PropriedadesEstruturaCampo = {
  id: string;
  rotulo: string;
  dica?: string;
  erros?: string[];
  children: ReactNode;
};

export default function EstruturaCampo({
  id,
  rotulo,
  dica,
  erros,
  children,
}: PropriedadesEstruturaCampo) {
  const descricao = descreverCampo(id, dica, erros);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      {children}
      {dica && (
        <p id={descricao.idDica} className="text-xs text-texto-suave">
          {dica}
        </p>
      )}
      {descricao.possuiErro && (
        <p id={descricao.idErro} className="text-xs text-erro">
          {erros?.join(' ')}
        </p>
      )}
    </div>
  );
}
