import Cartao from '@/components/ui/Cartao';
import MensagemAlerta from '@/components/ui/MensagemAlerta';
import FormularioEntrada from '@/screens/entrar/FormularioEntrada';
import { textosEntrada } from '@/screens/entrar/textosEntrada';

type PropriedadesTelaEntrada = {
  configuracaoConcluida: boolean;
};

export default function TelaEntrada({
  configuracaoConcluida,
}: PropriedadesTelaEntrada) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 sm:p-8">
      <Cartao className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{textosEntrada.titulo}</h1>
          <p className="text-sm text-texto-suave">{textosEntrada.descricao}</p>
        </header>
        {configuracaoConcluida && (
          <MensagemAlerta tipo="sucesso">
            {textosEntrada.configuracaoConcluida}
          </MensagemAlerta>
        )}
        <FormularioEntrada />
      </Cartao>
    </main>
  );
}
