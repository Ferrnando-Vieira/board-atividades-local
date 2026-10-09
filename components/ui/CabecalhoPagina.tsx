import type { ReactNode } from 'react';

type PropriedadesCabecalhoPagina = {
  titulo: string;
  descricao?: ReactNode;
};

// Título de página posto direto sobre o fundo do board: a cor do texto segue
// o tom calculado para o fundo (data-tom no <main>), então continua legível
// sobre fundos escuros, gradientes e imagens.
export default function CabecalhoPagina({
  titulo,
  descricao,
}: PropriedadesCabecalhoPagina) {
  return (
    <header className="flex flex-col gap-1 px-1">
      <h1 className="texto-superficie text-2xl font-semibold tracking-tight">
        {titulo}
      </h1>
      {descricao && (
        <p className="texto-superficie-suave max-w-3xl text-sm">{descricao}</p>
      )}
    </header>
  );
}
