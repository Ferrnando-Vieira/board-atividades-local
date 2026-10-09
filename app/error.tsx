'use client';

import { useEffect } from 'react';
import ErroInesperado from '@/components/ErroInesperado';

type PropriedadesErro = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function ErroRaiz({ error, retry }: PropriedadesErro) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErroInesperado aoTentarNovamente={retry} />;
}
