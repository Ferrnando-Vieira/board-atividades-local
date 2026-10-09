import Cartao from '@/components/ui/Cartao';
import { textosCompartilhamento as textos } from '@/screens/compartilhamento/textosCompartilhamento';

// Mesma tela para link inexistente, expirado ou revogado: a resposta não
// revela qual dos casos aconteceu.
export default function TelaCompartilhamentoIndisponivel() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 sm:p-8">
      <Cartao className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">{textos.indisponivelTitulo}</h1>
        <p className="text-sm text-texto-suave">
          {textos.indisponivelDescricao}
        </p>
      </Cartao>
    </main>
  );
}
