import type { InputHTMLAttributes } from 'react';
import { combinarClasses } from '@/util/ClassesUtils';

type PropriedadesCampo = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  rotulo: string;
  dica?: string;
  erros?: string[];
};

export default function CampoFormulario({
  id,
  rotulo,
  dica,
  erros,
  className,
  ...propriedades
}: PropriedadesCampo) {
  const possuiErro = Boolean(erros?.length);
  const idDica = dica ? `${id}-dica` : undefined;
  const idErro = possuiErro ? `${id}-erro` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <input
        id={id}
        aria-invalid={possuiErro}
        aria-describedby={
          [idDica, idErro].filter(Boolean).join(' ') || undefined
        }
        className={combinarClasses(
          'min-h-11 rounded-xl border bg-superficie px-3 text-base text-texto transition-colors hover:border-texto-suave/50 focus-visible:border-primaria focus-visible:outline-2 focus-visible:outline-primaria',
          possuiErro ? 'border-erro' : 'border-borda',
          className,
        )}
        {...propriedades}
      />
      {dica && (
        <p id={idDica} className="text-xs text-texto-suave">
          {dica}
        </p>
      )}
      {possuiErro && (
        <p id={idErro} className="text-xs text-erro">
          {erros?.join(' ')}
        </p>
      )}
    </div>
  );
}
