import type { ReactNode } from 'react';
import { combinarClasses } from '@/util/ClassesUtils';

type TipoAlerta = 'erro' | 'aviso' | 'sucesso';

type PropriedadesAlerta = {
  tipo: TipoAlerta;
  children: ReactNode;
};

const CLASSES_TIPO: Record<TipoAlerta, string> = {
  erro: 'border-erro/30 bg-erro-fundo text-erro',
  aviso: 'border-aviso/30 bg-aviso-fundo text-aviso',
  sucesso: 'border-sucesso/30 bg-sucesso-fundo text-sucesso',
};

export default function MensagemAlerta({ tipo, children }: PropriedadesAlerta) {
  return (
    <div
      role={tipo === 'erro' ? 'alert' : 'status'}
      className={combinarClasses(
        'rounded-lg border px-3 py-2 text-sm',
        CLASSES_TIPO[tipo],
      )}
    >
      {children}
    </div>
  );
}
