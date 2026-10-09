import type { InputHTMLAttributes } from 'react';

type PropriedadesCampoMarcacao = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  id: string;
  rotulo: string;
  dica?: string;
};

export default function CampoMarcacao({
  id,
  rotulo,
  dica,
  ...propriedades
}: PropriedadesCampoMarcacao) {
  const idDica = dica ? `${id}-dica` : undefined;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        aria-describedby={idDica}
        className="mt-1 size-5 shrink-0 accent-primaria"
        {...propriedades}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {rotulo}
        </label>
        {dica && (
          <p id={idDica} className="text-xs text-texto-suave">
            {dica}
          </p>
        )}
      </div>
    </div>
  );
}
